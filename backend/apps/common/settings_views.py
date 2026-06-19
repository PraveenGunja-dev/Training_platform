from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.actions import INSTRUCTOR_VISIBILITY_CHANGED
from apps.audit.services import log_action
from apps.common.permissions import IsAdmin

from .models import SystemSettings
from .serializers import SystemSettingsSerializer


@extend_schema(exclude=True)
class AdminSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request: Request) -> Response:
        settings_obj = SystemSettings.get_solo()
        return Response({"data": SystemSettingsSerializer(settings_obj).data})

    def patch(self, request: Request) -> Response:
        settings_obj = SystemSettings.get_solo()
        old_visibility = settings_obj.instructors_can_view_all_classes
        ser = SystemSettingsSerializer(settings_obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if "instructors_can_view_all_classes" in request.data:
            new_visibility = settings_obj.instructors_can_view_all_classes
            if old_visibility != new_visibility:
                log_action(
                    actor=request.user,
                    action=INSTRUCTOR_VISIBILITY_CHANGED,
                    target_type="SystemSettings",
                    target_id=1,
                    metadata={"scope": "system", "old": old_visibility, "new": new_visibility},
                )
        return Response({"data": ser.data})


@extend_schema(exclude=True)
class ForceLogoutView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request: Request) -> Response:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        qs = OutstandingToken.objects.exclude(user=request.user)
        cleared = qs.count()
        for token in qs:
            BlacklistedToken.objects.get_or_create(token=token)
        log_action(
            actor=request.user,
            action="system.force_logout_all",
            target_type="SystemSettings",
            target_id=None,
            metadata={"cleared_sessions": cleared},
        )
        return Response(
            {"data": {"cleared": cleared}},
            status=status.HTTP_200_OK,
        )
