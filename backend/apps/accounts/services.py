import hashlib
import logging
import secrets
import string
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import EmailMultiAlternatives
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.template.loader import render_to_string
from django.utils import timezone

from .models import PasswordSetupToken, User

logger = logging.getLogger(__name__)

INVITE_TOKEN_MAX_AGE = 60 * 60 * 48  # 48 hours in seconds

_ROLE_DISPLAY = {
    "ADMIN": "Administrator",
    "INSTRUCTOR": "Instructor",
    "PARTICIPANT": "Participant",
}

_PASSWORD_CHARS = string.ascii_lowercase + string.ascii_uppercase + string.digits + "!@#$"


def _generate_temp_password(length: int = 12) -> str:
    """Return a random password that contains at least one of each required character class."""
    while True:
        pwd = "".join(secrets.choice(_PASSWORD_CHARS) for _ in range(length))
        if (
            any(c.islower() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$" for c in pwd)
        ):
            return pwd


def invite_user(
    *, email: str, role: str, full_name: str, invited_by: User, resend: bool = False
) -> User:
    email = email.strip().lower()
    temp_password = _generate_temp_password()

    if resend:
        user = User.objects.get(email__iexact=email)
    else:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={"full_name": full_name, "role": role, "is_active": False},
        )
        if not created and user.is_active:
            raise ValueError("A user with this email is already active.")

    # Set default password and activate the account immediately.
    user.set_password("admin123")
    user.is_active = True
    user.must_change_password = True
    user.save(update_fields=["password", "is_active", "must_change_password"])

    # Create a setup token so the user can set their own password via the invite link.
    signer = TimestampSigner()
    raw_token = signer.sign(str(user.id))
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    PasswordSetupToken.objects.update_or_create(
        user=user,
        defaults={
            "token_hash": token_hash,
            "consumed_at": None,
            "expires_at": timezone.now() + timedelta(hours=72),
        },
    )

    logger.info("User registered: %s (role=%s) by %s", email, role, invited_by.email)
    return user


def consume_setup_token(*, token: str, password: str) -> User:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        setup_token = PasswordSetupToken.objects.get(
            token_hash=token_hash,
            consumed_at__isnull=True,
        )
    except PasswordSetupToken.DoesNotExist as exc:
        raise ValueError("invite_token_invalid") from exc

    if setup_token.expires_at and setup_token.expires_at < timezone.now():
        raise ValueError("invite_token_expired")

    signer = TimestampSigner()
    try:
        signer.unsign(token, max_age=INVITE_TOKEN_MAX_AGE)
    except SignatureExpired as exc:
        raise ValueError("invite_token_expired") from exc
    except BadSignature as exc:
        raise ValueError("invite_token_invalid") from exc

    user = setup_token.user
    user.set_password(password)
    user.is_active = True
    user.save(update_fields=["password", "is_active"])

    setup_token.consumed_at = timezone.now()
    setup_token.save(update_fields=["consumed_at"])

    return user


def authenticate_user(*, email: str, password: str) -> "User | None":
    from typing import cast as _cast
    result = authenticate(username=email.lower(), password=password)
    return _cast("User | None", result)
