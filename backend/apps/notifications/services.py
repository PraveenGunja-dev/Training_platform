from __future__ import annotations

import logging

from django.utils import timezone

from .models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


def create_inapp(
    user,
    type: str,
    title: str,
    body: str,
    link: str,
    dedupe_key: str,
    payload: dict,
) -> Notification:
    """Idempotent — returns existing notification if dedupe_key already exists."""
    notification, _ = Notification.objects.get_or_create(
        dedupe_key=dedupe_key,
        defaults={
            "user": user,
            "type": type,
            "channel": "IN_APP",
            "title": title,
            "body": body,
            "link": link,
            "status": "SENT",
            "sent_at": timezone.now(),
            "payload": payload,
        },
    )
    return notification


def _send_email_notification(user, title: str, body: str) -> None:
    """Send a plain-text email notification if EMAIL_BACKEND is configured."""
    try:
        from django.conf import settings
        from django.core.mail import EmailMessage

        if not getattr(settings, "EMAIL_HOST", ""):
            return
        msg = EmailMessage(
            subject=title,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        msg.send(fail_silently=True)
    except Exception:
        logger.exception("Failed to send email notification to user %s", user.id)


def notify_instructors(
    group,
    notification_type: str,
    title: str,
    body: str,
    link: str,
    payload: dict,
    actor=None,
    dedupe_suffix: str = "",
) -> int:
    """
    Send in-app notification to all instructors assigned to group, excluding actor.
    Returns count of notifications created (new ones only; skips duplicates).
    Respects each instructor's email preference.
    """
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    qs = GroupInstructor.objects.filter(group=group).select_related("instructor")
    if actor is not None:
        qs = qs.exclude(instructor=actor)

    count = 0
    suffix = dedupe_suffix or timezone.now().strftime("%Y%m%d")
    for gi in qs:
        user = gi.instructor
        dk = f"{notification_type.lower()}:{group.id}:{user.id}:{suffix}"
        notif, created = Notification.objects.get_or_create(
            dedupe_key=dk,
            defaults={
                "user": user,
                "type": notification_type,
                "channel": "IN_APP",
                "title": title,
                "body": body,
                "link": link,
                "status": "SENT",
                "sent_at": timezone.now(),
                "payload": payload,
            },
        )
        if created:
            count += 1
            prefs = NotificationPreference.objects.filter(user=user).first()
            if prefs and prefs.email_enabled:
                _send_email_notification(user, title, body)
    return count
