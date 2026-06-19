from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin, IsAdminOrInstructor

from .org_chart import get_org_chart_data
from .services import compute_admin_payload, compute_group_admin_payload, compute_instructor_payload, compute_participant_payload


@extend_schema(exclude=True)
class AdminDashboardView(APIView):
    permission_classes = [IsAdminOrInstructor]

    def get(self, request: Request) -> Response:
        if request.user.role == "INSTRUCTOR":
            payload = compute_instructor_payload(request.user)
        elif request.user.role == "ADMIN":
            group_id = request.query_params.get("group_id") or None
            payload = compute_admin_payload(group_id=group_id)
        else:
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({"data": payload})


@extend_schema(exclude=True)
class OrgChartView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request: Request) -> Response:
        return Response({"data": get_org_chart_data()})


@extend_schema(exclude=True)
class ParticipantDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        payload = compute_participant_payload(request.user)
        return Response({"data": payload})


@extend_schema(exclude=True)
class GroupAdminDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if request.user.role != "GROUP_ADMIN":
            return Response({"detail": "Forbidden."}, status=403)
        from apps.groups.models import GroupAdmin
        ga = GroupAdmin.objects.filter(admin=request.user).first()
        if not ga:
            return Response({"detail": "No group assigned."}, status=404)
        payload = compute_group_admin_payload(str(ga.group_id))
        return Response({"data": payload})
