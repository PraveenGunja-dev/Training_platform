from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin, IsAdminOrSubMentor, IsAdminOrLeadMentorOrSubMentor

from .org_chart import get_org_chart_data
from .services import (
    compute_admin_payload,
    compute_batch_breakdown,
    compute_lead_mentor_payload,
    compute_participant_payload,
    compute_sub_mentor_payload,
)


@extend_schema(exclude=True)
class AdminDashboardView(APIView):
    permission_classes = [IsAdminOrLeadMentorOrSubMentor]

    def get(self, request: Request) -> Response:
        if request.user.role == "SUB_MENTOR":
            payload = compute_sub_mentor_payload(request.user)
        elif request.user.role == "ADMIN":
            group_id = request.query_params.get("group_id") or None
            payload = compute_admin_payload(group_id=group_id)
        elif request.user.role == "LEAD_MENTOR":
            from apps.groups.models import GroupLeadMentor  # noqa: PLC0415
            ga = GroupLeadMentor.objects.filter(lead_mentor=request.user).first()
            if not ga:
                return Response({"detail": "No group assigned."}, status=404)
            payload = compute_lead_mentor_payload(str(ga.group_id))
        else:
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({"data": payload})


@extend_schema(exclude=True)
class AdminDashboardBreakdownView(APIView):
    """
    GET /api/analytics/dashboard/admin/breakdown/

    Returns per-batch KPI breakdown and day-wise attendance data
    for the last 14 days. Admin-only.
    """
    permission_classes = [IsAdmin]

    def get(self, request: Request) -> Response:
        payload = compute_batch_breakdown()
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
class LeadMentorDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if request.user.role == "LEAD_MENTOR":
            from apps.groups.models import GroupLeadMentor  # noqa: PLC0415
            ga = GroupLeadMentor.objects.filter(lead_mentor=request.user).first()
            if not ga:
                return Response({"detail": "No group assigned."}, status=404)
            group_id = str(ga.group_id)

        elif request.user.role == "SUB_MENTOR":
            from apps.groups.models import GroupSubMentor  # noqa: PLC0415
            group_id_param = request.query_params.get("group_id")
            if group_id_param:
                assigned = GroupSubMentor.objects.filter(
                    sub_mentor=request.user, group_id=group_id_param
                ).exists()
                if not assigned:
                    return Response(
                        {"errors": [{"code": "perm.not_sub_mentor_of_group", "message": "You are not assigned to this group."}], "data": None},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                group_id = group_id_param
            else:
                ga = GroupSubMentor.objects.filter(sub_mentor=request.user).first()
                if not ga:
                    return Response({"detail": "No group assigned."}, status=404)
                group_id = str(ga.group_id)

        else:
            return Response({"detail": "Forbidden."}, status=403)

        payload = compute_lead_mentor_payload(group_id)
        return Response({"data": payload})
