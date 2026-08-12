from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.actions import SUB_MENTOR_VISIBILITY_CHANGED
from apps.audit.services import log_action
from apps.common.permissions import IsAdmin

from .models import SystemSettings
from .serializers import SystemSettingsSerializer

_AUDITABLE_FIELDS = [
    "timezone",
    "reminder_offsets",
    "session_lifetime_hours",
    "sub_mentors_can_view_all_classes",
    "attendance_drift_threshold_minutes",
]


@extend_schema(exclude=True)
class AdminSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request: Request) -> Response:
        settings_obj = SystemSettings.get_solo()
        return Response({"data": SystemSettingsSerializer(settings_obj).data})

    def patch(self, request: Request) -> Response:
        settings_obj = SystemSettings.get_solo()

        old_snapshot = {
            f: getattr(settings_obj, f)
            for f in _AUDITABLE_FIELDS
            if f in request.data
        }

        ser = SystemSettingsSerializer(settings_obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()

        changes = {
            f: {"old": old_snapshot[f], "new": getattr(settings_obj, f)}
            for f in old_snapshot
            if old_snapshot[f] != getattr(settings_obj, f)
        }

        if changes:
            log_action(
                actor=request.user,
                action="system.settings_updated",
                target_type="SystemSettings",
                target_id="1",
                metadata=changes,
            )

        visibility_change = changes.get("sub_mentors_can_view_all_classes")
        if visibility_change:
            log_action(
                actor=request.user,
                action=SUB_MENTOR_VISIBILITY_CHANGED,
                target_type="SystemSettings",
                target_id="1",
                metadata={
                    "scope": "system",
                    "old": visibility_change["old"],
                    "new": visibility_change["new"],
                },
            )

        return Response({"data": ser.data})


@extend_schema(exclude=True)
class ForceLogoutView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request: Request) -> Response:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        qs = OutstandingToken.objects.exclude(user=request.user)
        cleared = qs.count()
        already_blacklisted_ids = set(
            BlacklistedToken.objects.filter(token__in=qs).values_list("token_id", flat=True)
        )
        BlacklistedToken.objects.bulk_create(
            [BlacklistedToken(token=t) for t in qs if t.pk not in already_blacklisted_ids],
            ignore_conflicts=True,
        )
        log_action(
            actor=request.user,
            action="system.force_logout_all",
            target_type="SystemSettings",
            target_id="system",
            metadata={"cleared_sessions": cleared},
        )
        return Response(
            {"data": {"cleared": cleared}},
            status=status.HTTP_200_OK,
        )
