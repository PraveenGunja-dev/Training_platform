from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin, IsAdminOrInstructor

from .org_chart import get_org_chart_data
from .services import compute_admin_payload, compute_instructor_payload, compute_participant_payload


@extend_schema(exclude=True)
class AdminDashboardView(APIView):
    permission_classes = [IsAdminOrInstructor]

    def get(self, request: Request) -> Response:
        if request.user.role == "INSTRUCTOR":
            payload = compute_instructor_payload(request.user)
        else:
            group_id = request.query_params.get("group_id") or None
            payload = compute_admin_payload(group_id=group_id)
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
