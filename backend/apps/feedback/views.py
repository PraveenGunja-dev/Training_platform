from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin, IsAdminOrLeadMentorOrSubMentor, IsLeadMentorOrSubMentor
from apps.common.scoping import lead_mentor_class_qs, sub_mentor_class_qs
from apps.groups.models import GroupMembership
from apps.scheduling.models import Class

from .models import ClassFeedback
from .serializers import ClassFeedbackReadSerializer, ClassFeedbackWriteSerializer


def _participant_only(request: Request) -> Response | None:
    """Return a 403 Response if the caller is not a PARTICIPANT, else None."""
    if not request.user.is_authenticated or request.user.role != "PARTICIPANT":
        return Response(
            {
                "errors": [
                    {
                        "code": "perm.participant_only",
                        "message": "Only participants can access this endpoint.",
                    }
                ],
                "data": None,
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


# ---------------------------------------------------------------------------
# POST /feedback/submit
# ---------------------------------------------------------------------------


class SubmitFeedbackView(APIView):
    """Submit feedback for a completed class. PARTICIPANT only."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        denied = _participant_only(request)
        if denied:
            return denied

        serializer = ClassFeedbackWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        class_session = get_object_or_404(
            Class.objects.select_related("group"), pk=data["class_session_id"]
        )

        if class_session.computed_status != Class.STATUS_COMPLETED:
            return Response(
                {
                    "errors": [
                        {
                            "code": "feedback.class_not_completed",
                            "message": "Feedback can only be submitted for completed classes.",
                        }
                    ],
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrolled = GroupMembership.objects.filter(
            user=request.user, group=class_session.group
        ).exists()
        if not enrolled:
            return Response(
                {
                    "errors": [
                        {
                            "code": "feedback.not_enrolled",
                            "message": "You are not enrolled in this class's group.",
                        }
                    ],
                    "data": None,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if ClassFeedback.objects.filter(
            class_session=class_session, participant=request.user
        ).exists():
            return Response(
                {
                    "errors": [
                        {
                            "code": "already_submitted",
                            "message": "You have already submitted feedback for this class.",
                        }
                    ],
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        feedback = ClassFeedback.objects.create(
            class_session=class_session,
            participant=request.user,
            rating=data["rating"],
            comment=data.get("comment", ""),
        )
        return Response(
            {"data": ClassFeedbackReadSerializer(feedback).data},
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# GET /feedback/my
# ---------------------------------------------------------------------------


class MyFeedbackView(APIView):
    """Return the calling participant's own feedback for a given class. PARTICIPANT only."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        denied = _participant_only(request)
        if denied:
            return denied

        class_id = request.query_params.get("class_id")
        if not class_id:
            return Response(
                {
                    "errors": [
                        {
                            "code": "feedback.missing_class_id",
                            "message": "Query parameter 'class_id' is required.",
                        }
                    ],
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        feedback = (
            ClassFeedback.objects.select_related("participant")
            .filter(class_session_id=class_id, participant=request.user)
            .first()
        )
        return Response({"data": ClassFeedbackReadSerializer(feedback).data if feedback else None})


# ---------------------------------------------------------------------------
# GET /feedback/list
# ---------------------------------------------------------------------------


class FeedbackListView(APIView):
    """List all feedback for a class. ADMIN sees all; LEAD_MENTOR/SUB_MENTOR scoped to assigned groups."""

    permission_classes = [IsAdminOrLeadMentorOrSubMentor]

    def get(self, request: Request) -> Response:
        class_id = request.query_params.get("class_id")
        if not class_id:
            return Response(
                {
                    "errors": [
                        {
                            "code": "feedback.missing_class_id",
                            "message": "Query parameter 'class_id' is required.",
                        }
                    ],
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ADMIN can access any class; mentors are scoped to their assigned groups.
        if request.user.role != "ADMIN":
            if request.user.role == "SUB_MENTOR":
                allowed_qs = sub_mentor_class_qs(request.user)
            else:  # LEAD_MENTOR
                allowed_qs = lead_mentor_class_qs(request.user)

            if not allowed_qs.filter(pk=class_id).exists():
                return Response(
                    {
                        "errors": [
                            {
                                "code": "perm.class_not_assigned",
                                "message": "You are not assigned to this class.",
                            }
                        ],
                        "data": None,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        feedbacks = (
            ClassFeedback.objects.filter(class_session_id=class_id)
            .select_related("participant")
            .order_by("submitted_at")
        )
        return Response({"data": ClassFeedbackReadSerializer(feedbacks, many=True).data})


# ---------------------------------------------------------------------------
# GET /feedback/admin
# ---------------------------------------------------------------------------


class FeedbackAdminView(APIView):
    """Paginated feedback list with aggregate stats. SUPER_ADMIN (role == "ADMIN") only."""

    permission_classes = [IsAdmin]

    def get(self, request: Request) -> Response:
        from django.db.models import Avg, Count  # noqa: PLC0415

        qs = ClassFeedback.objects.select_related("participant", "class_session__group")

        batch_id = request.query_params.get("batch_id")
        class_id = request.query_params.get("class_id")
        mentor_id = request.query_params.get("mentor_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if batch_id:
            qs = qs.filter(class_session__group_id=batch_id)
        if class_id:
            qs = qs.filter(class_session_id=class_id)
        if mentor_id:
            from apps.groups.models import GroupLeadMentor, GroupSubMentor  # noqa: PLC0415
            sub_group_ids = GroupSubMentor.objects.filter(
                sub_mentor_id=mentor_id
            ).values_list("group_id", flat=True)
            lead_group_ids = GroupLeadMentor.objects.filter(
                lead_mentor_id=mentor_id
            ).values_list("group_id", flat=True)
            mentor_group_ids = list(sub_group_ids) + list(lead_group_ids)
            qs = qs.filter(class_session__group_id__in=mentor_group_ids)
        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        agg = qs.aggregate(avg_rating=Avg("rating"), total_count=Count("id"))

        class_ids_in_qs = list(qs.values_list("class_session_id", flat=True).distinct())
        group_class_counts = (
            Class.objects.filter(pk__in=class_ids_in_qs)
            .values("group_id")
            .annotate(cls_count=Count("id"))
        )
        total_possible = sum(
            GroupMembership.objects.filter(group_id=row["group_id"]).count() * row["cls_count"]
            for row in group_class_counts
        )
        submitted_count = agg["total_count"] or 0
        response_rate = (
            round(submitted_count / total_possible * 100, 1)
            if total_possible
            else 0.0
        )

        try:
            page_size = min(int(request.query_params.get("page_size", 50)), 200)
            page = max(int(request.query_params.get("page", 1)), 1)
        except (ValueError, TypeError):
            page_size, page = 50, 1

        total = qs.count()
        offset = (page - 1) * page_size
        items = qs[offset : offset + page_size]

        return Response(
            {
                "data": ClassFeedbackReadSerializer(items, many=True).data,
                "meta": {
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                    "avg_rating": agg["avg_rating"],
                    "total_count": submitted_count,
                    "response_rate": response_rate,
                },
            }
        )


# ---------------------------------------------------------------------------
# GET /feedback/analytics
# ---------------------------------------------------------------------------


class FeedbackAnalyticsView(APIView):
    """Feedback analytics summary. SUPER_ADMIN (role == "ADMIN") only."""

    permission_classes = [IsAdmin]

    def get(self, request: Request) -> Response:
        from apps.analytics.services import compute_feedback_analytics  # noqa: PLC0415

        filters = {
            k: request.query_params.get(k)
            for k in ("batch_id", "class_id", "mentor_id", "date_from", "date_to")
            if request.query_params.get(k)
        }
        payload = compute_feedback_analytics(filters)
        return Response({"data": payload})
