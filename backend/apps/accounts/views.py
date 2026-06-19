from datetime import timedelta
from typing import Literal, cast

from django.conf import settings
import os

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    ChangeEmailSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    SetPasswordSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.audit.services import log_action
from .services import authenticate_user, consume_setup_token
from .throttles import ChangePasswordThrottle, LoginRateThrottle, RefreshTokenThrottle


_MAGIC_BYTES = [
    b'\xff\xd8\xff',   # JPEG
    b'\x89PNG\r\n',    # PNG
    b'GIF87a',         # GIF
    b'GIF89a',         # GIF
    b'RIFF',           # WebP (starts with RIFF....WEBP)
]


def _check_magic_bytes(file_obj) -> bool:
    """Return True if the file header matches a known safe image type."""
    header = file_obj.read(12)
    file_obj.seek(0)
    return any(header.startswith(magic) for magic in _MAGIC_BYTES)


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    samesite = cast(Literal["Lax", "Strict", "None", False], settings.JWT_REFRESH_COOKIE_SAMESITE)
    lifetime = cast(timedelta, settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"])
    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=settings.JWT_REFRESH_COOKIE_HTTPONLY,
        samesite=samesite,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        max_age=int(lifetime.total_seconds()),
    )


@extend_schema(exclude=True)
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        user = authenticate_user(
            email=email,
            password=serializer.validated_data["password"],
        )
        if user is None:
            log_action(
                actor=None,
                action="auth.login_failed",
                target_type="User",
                target_id=None,
                metadata={
                    "email": email,
                    "ip": request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown")),
                    "reason": "invalid_credentials",
                },
            )
            return Response(
                {"errors": [{"code": "auth.invalid_credentials", "message": "Invalid email or password."}], "data": None},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # After confirming credentials are correct, check if account is blocked.
        # This ordering avoids user enumeration via status-code differences.
        if not user.is_active:
            log_action(
                actor=None,
                action="auth.login_failed",
                target_type="User",
                target_id=user.id,
                metadata={
                    "email": email,
                    "ip": request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown")),
                    "reason": "account_inactive",
                },
            )
            return Response(
                {"errors": [{"code": "auth.invalid_credentials", "message": "Invalid email or password."}], "data": None},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        from django.utils import timezone
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        refresh = cast(RefreshToken, RefreshToken.for_user(user))
        response = Response(
            {"data": {"access": str(refresh.access_token), "user": UserSerializer(user).data}},
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(refresh))
        return response


@extend_schema(exclude=True)
class RefreshView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RefreshTokenThrottle]

    def post(self, request: Request) -> Response:
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not raw_refresh:
            return Response(
                {"errors": [{"code": "auth.no_refresh_token", "message": "Refresh token missing"}], "data": None},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            refresh = RefreshToken(raw_refresh)  # type: ignore[arg-type]
            new_access = str(refresh.access_token)
            new_refresh = str(refresh)
        except (InvalidToken, TokenError) as exc:
            return Response(
                {"errors": [{"code": "auth.invalid_token", "message": str(exc)}], "data": None},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        response = Response({"data": {"access": new_access}}, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, new_refresh)
        return response


@extend_schema(exclude=True)
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()  # type: ignore[arg-type]
            except Exception:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            key=settings.JWT_REFRESH_COOKIE_NAME,
            path=settings.JWT_REFRESH_COOKIE_PATH,
        )
        return response


@extend_schema(exclude=True)
class SetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = consume_setup_token(
                token=serializer.validated_data["token"],
                password=serializer.validated_data["password"],
            )
        except ValueError as exc:
            code = str(exc)
            return Response(
                {"errors": [{"code": code, "message": "Token is invalid or expired"}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = cast(RefreshToken, RefreshToken.for_user(user))
        response = Response(
            {"data": {"access": str(refresh.access_token), "user": UserSerializer(user).data}},
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(refresh))
        return response


@extend_schema(exclude=True)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ChangePasswordThrottle]

    def post(self, request: Request) -> Response:
        s = ChangePasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(s.validated_data["current_password"]):
            return Response(
                {"errors": [{"code": "auth.wrong_password", "detail": "Current password is incorrect."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(s.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])

        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)

        return Response({"data": {"detail": "Password changed successfully."}})


@extend_schema(exclude=True)
class ChangeEmailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ChangePasswordThrottle]

    def post(self, request: Request) -> Response:
        s = ChangeEmailSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user = request.user
        current_email: str = s.validated_data["current_email"]
        new_email: str = s.validated_data["new_email"]
        current_password: str = s.validated_data["current_password"]

        if user.email != current_email:
            return Response(
                {"errors": [{"code": "email.wrong_current", "message": "Current email is incorrect."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {"errors": [{"code": "auth.wrong_password", "message": "Current password is incorrect."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_email == user.email:
            return Response(
                {"errors": [{"code": "email.same_as_current", "message": "New email must be different from current email."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
            return Response(
                {"errors": [{"code": "email.already_exists", "message": "This email address is already in use."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.email = new_email
        user.save(update_fields=["email"])

        return Response({"data": {"email": new_email, "detail": "Email updated successfully."}})


@extend_schema(exclude=True)
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response({"data": UserSerializer(request.user).data})

    def patch(self, request: Request) -> Response:
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": UserSerializer(request.user).data})


@extend_schema(exclude=True)
class MePhotoView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    _ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    _MAX_BYTES = 5 * 1024 * 1024  # 5 MB

    def post(self, request: Request) -> Response:
        photo = request.FILES.get("photo")
        if not photo:
            return Response(
                {"errors": [{"code": "photo.missing", "message": "No photo file provided"}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if photo.content_type not in self._ALLOWED:
            return Response(
                {"errors": [{"code": "photo.invalid_type", "message": "Only JPEG, PNG, WEBP or GIF allowed"}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if photo.size > self._MAX_BYTES:
            return Response(
                {"errors": [{"code": "photo.too_large", "message": "Photo must be under 5 MB"}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _check_magic_bytes(photo):
            return Response(
                {"errors": [{"code": "file.invalid_signature", "message": "Uploaded file is not a valid image."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(photo.content_type, "jpg")
        blob_name = f"photos/{request.user.id}/avatar.{ext}"
        content = photo.read()

        photo_url = self._store(blob_name, content, photo.content_type)
        request.user.photo_url = photo_url  # type: ignore[attr-defined]
        request.user.save(update_fields=["photo_url"])  # type: ignore[attr-defined]

        return Response({"data": UserSerializer(request.user).data})

    def _store(self, blob_name: str, content: bytes, content_type: str) -> str:
        from apps.assignments.storage import _azure_config

        account_name, account_key, container = _azure_config()
        if all([account_name, account_key, container]):
            try:
                from azure.storage.blob import BlobServiceClient  # type: ignore[import]

                client = BlobServiceClient(
                    account_url=f"https://{account_name}.blob.core.windows.net",
                    credential=account_key,
                )
                client.get_blob_client(container=container, blob=blob_name).upload_blob(
                    content, overwrite=True, content_settings={"content_type": content_type}
                )
                return f"https://{account_name}.blob.core.windows.net/{container}/{blob_name}"
            except ImportError:
                pass

        # Dev fallback — save to dev_media/
        dest = os.path.join(settings.BASE_DIR, "dev_media", blob_name)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(content)
        return f"http://localhost:8000/api/v1/dev/download/{blob_name}"
