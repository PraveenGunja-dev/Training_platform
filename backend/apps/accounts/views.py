from datetime import timedelta
from typing import Literal, cast

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

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

        content = photo.read()
        user = request.user
        user.photo_data = content  # type: ignore[attr-defined]
        user.photo_content_type = photo.content_type  # type: ignore[attr-defined]
        user.photo_url = f"/api/v1/users/{user.id}/photo"  # type: ignore[attr-defined]
        user.save(update_fields=["photo_data", "photo_content_type", "photo_url"])  # type: ignore[attr-defined]

        return Response({"data": UserSerializer(user).data})


@extend_schema(exclude=True)
class UserPhotoView(APIView):
    """GET /users/{pk}/photo — serve profile photo binary. No auth required (profile photos are public)."""
    permission_classes = []

    def get(self, request: Request, pk: str) -> Response:
        user = get_object_or_404(
            User.objects.only("id", "photo_data", "photo_content_type"), pk=pk
        )
        if not user.photo_data:
            return Response(
                {"errors": [{"code": "not_found", "message": "No photo uploaded."}], "data": None},
                status=status.HTTP_404_NOT_FOUND,
            )
        return HttpResponse(
            bytes(user.photo_data),
            content_type=user.photo_content_type or "image/jpeg",
        )
