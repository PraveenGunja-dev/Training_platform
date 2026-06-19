from __future__ import annotations

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.services import log_action
from apps.common.pagination import AuditCursorPagination
from apps.common.permissions import IsAdminOrInstructor
from apps.common.scoping import instructor_owns_group, instructor_session_qs
from apps.groups.models import GroupMembership
from apps.scheduling.models import Class

from .models import AttendanceRecord, AttendanceSession
from .serializers import AttendanceRecordSerializer, AttendanceSessionSerializer
from .services import AttendanceError, build_report, end_session, mark_attendance, maybe_end_expired_session, start_session


def _error_response(exc: AttendanceError) -> Response:
    return Response(
        {"errors": [{"code": exc.code, "message": exc.message}], "data": None},
        status=exc.http,
    )


# ---------------------------------------------------------------------------
# Admin: SessionViewSet
# ---------------------------------------------------------------------------


class AdminSessionViewSet(ViewSet):
    """Admin / Instructor CRUD + actions on AttendanceSessions."""

    permission_classes = [IsAdminOrInstructor]
    serializer_class = AttendanceSessionSerializer

    _INSTRUCTOR_DENIED = {
        "errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}],
        "data": None,
    }

    def _base_qs(self):
        return AttendanceSession.objects.select_related(
            "class_obj__group", "started_by", "ended_by"
        )

    def list(self, request: Request) -> Response:
        if request.user.role == "INSTRUCTOR":
            qs = instructor_session_qs(request.user).select_related(
                "class_obj__group", "started_by", "ended_by"
            )
        else:
            qs = self._base_qs()
        class_id = request.query_params.get("class_id")
        session_status = request.query_params.get("status")
        from_dt = request.query_params.get("from")
        to_dt = request.query_params.get("to")
        if class_id:
            qs = qs.filter(class_obj_id=class_id)
        if session_status:
            qs = qs.filter(status=session_status)
        if from_dt:
            parsed_from = parse_datetime(from_dt)
            if parsed_from is None:
                return Response(
                    {"errors": [{"code": "invalid", "message": "Invalid 'from' datetime format", "field": "from"}], "data": None},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = qs.filter(started_at__gte=parsed_from)
        if to_dt:
            parsed_to = parse_datetime(to_dt)
            if parsed_to is None:
                return Response(
                    {"errors": [{"code": "invalid", "message": "Invalid 'to' datetime format", "field": "to"}], "data": None},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = qs.filter(started_at__lte=parsed_to)
        qs = qs.annotate(
            present_count=Count("records", filter=Q(records__status="PRESENT")),
            absent_count=Count("records", filter=Q(records__status="ABSENT")),
        ).order_by("-started_at")
        paginator = AuditCursorPagination()
        paginator.ordering = "-started_at"
        page = paginator.paginate_queryset(qs, request)
        serializer = AttendanceSessionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def create(self, request: Request) -> Response:
        class_id = request.data.get("class_id")
        if not class_id:
            return Response(
                {"errors": [{"code": "invalid", "message": "class_id is required", "field": "class_id"}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        duration_minutes_raw = request.data.get("duration_minutes")
        duration_minutes = None
        if duration_minutes_raw is not None:
            try:
                duration_minutes = int(duration_minutes_raw)
                if duration_minutes <= 0:
                    return Response(
                        {"errors": [{"code": "invalid", "message": "duration_minutes must be positive", "field": "duration_minutes"}], "data": None},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except (ValueError, TypeError):
                return Response(
                    {"errors": [{"code": "invalid", "message": "duration_minutes must be an integer", "field": "duration_minutes"}], "data": None},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        class_obj = get_object_or_404(Class.objects.select_related("group"), pk=class_id)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, class_obj.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        try:
            session = start_session(class_obj=class_obj, actor=request.user, duration_minutes=duration_minutes)
        except AttendanceError as exc:
            return _error_response(exc)
        session_fresh = self._base_qs().get(pk=session.pk)
        return Response(
            {"data": AttendanceSessionSerializer(session_fresh).data},
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        session = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, session.class_obj.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response({"data": AttendanceSessionSerializer(session).data})

    def end(self, request: Request, pk: str | None = None) -> Response:
        session = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, session.class_obj.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        try:
            session = end_session(session=session, actor=request.user)
        except AttendanceError as exc:
            return _error_response(exc)
        session_fresh = self._base_qs().get(pk=session.pk)
        return Response({"data": AttendanceSessionSerializer(session_fresh).data})

    def report(self, request: Request, pk: str | None = None) -> Response:
        session = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, session.class_obj.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        data = build_report(session=session)
        records_payload = [
            {
                "user": {
                    "id": str(row["user"].id),
                    "full_name": row["user"].full_name,
                    "email": row["user"].email,
                },
                "status": row["status"],
                "marked_at": row["marked_at"].isoformat() if row["marked_at"] else None,
            }
            for row in data["rows"]
        ]
        return Response(
            {
                "data": {
                    "session": AttendanceSessionSerializer(session).data,
                    "records": records_payload,
                    "summary": data["summary"],
                }
            }
        )


# ---------------------------------------------------------------------------
# Admin: Record override
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class AdminRecordOverrideView(APIView):
    """PATCH /api/v1/admin/attendance/records/:id — manual status override."""

    permission_classes = [IsAdminOrInstructor]

    _INSTRUCTOR_DENIED = {
        "errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}],
        "data": None,
    }

    def patch(self, request: Request, pk: str) -> Response:
        record = get_object_or_404(
            AttendanceRecord.objects.select_related("session__class_obj", "user"), pk=pk
        )
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(
            request.user, record.session.class_obj.group_id
        ):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        new_status = request.data.get("status")
        if new_status not in dict(AttendanceRecord.STATUS_CHOICES):
            return Response(
                {"errors": [{"code": "invalid", "message": "Invalid status", "field": "status"}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if record.session.status == "ENDED":
            return Response(
                {"errors": [{"code": "session.already_ended", "message": "Cannot override attendance on an ended session."}], "data": None},
                status=status.HTTP_409_CONFLICT,
            )
        old_status = record.status
        record.status = new_status
        record.save(update_fields=["status"])
        log_action(
            actor=request.user,
            action="attendance.record_overridden",
            target_type="AttendanceRecord",
            target_id=record.id,
            metadata={
                "old_status": old_status,
                "new_status": new_status,
                "session_id": str(record.session_id),
                "user_id": str(record.user_id),
            },
        )
        return Response({"data": AttendanceRecordSerializer(record).data})


# ---------------------------------------------------------------------------
# Participant: active-session
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class ActiveSessionView(APIView):
    """GET /api/v1/attendance/active-session — returns the active session for the participant."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        group_ids = GroupMembership.objects.filter(user=request.user).values_list(
            "group_id", flat=True
        )
        sessions = (
            AttendanceSession.objects.filter(
                class_obj__group_id__in=group_ids, status="ACTIVE"
            )
            .select_related("class_obj__group", "started_by", "ended_by")
            .order_by("-started_at")
        )

        warning = None
        if sessions.count() > 1:
            warning = "multiple_active"

        session = sessions.first()
        if session is None:
            return Response({"data": {"session": None, "my_record": None}})

        session = maybe_end_expired_session(session)
        if session.status != "ACTIVE":
            return Response({"data": {"session": None, "my_record": None}})

        my_record = AttendanceRecord.objects.filter(
            session=session, user=request.user
        ).first()

        session_data = AttendanceSessionSerializer(session).data
        record_data = AttendanceRecordSerializer(my_record).data if my_record else None

        response_data: dict = {"session": session_data, "my_record": record_data}
        if warning:
            response_data["_warning"] = warning
        return Response({"data": response_data})


# ---------------------------------------------------------------------------
# Participant: mark attendance
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class MarkAttendanceView(APIView):
    """POST /api/v1/attendance/sessions/:id/mark."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, pk: str) -> Response:
        group_ids = GroupMembership.objects.filter(user=request.user).values_list("group_id", flat=True)
        session = get_object_or_404(
            AttendanceSession.objects.select_related("class_obj__group").filter(
                class_obj__group_id__in=group_ids
            ),
            pk=pk,
        )
        try:
            record = mark_attendance(session=session, user=request.user)
        except AttendanceError as exc:
            return _error_response(exc)
        return Response({"data": AttendanceRecordSerializer(record).data})
