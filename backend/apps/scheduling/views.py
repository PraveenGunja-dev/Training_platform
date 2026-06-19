from __future__ import annotations

from datetime import timedelta

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.services import log_action
from apps.common.permissions import IsAdminOrInstructor
from apps.common.scoping import instructor_class_qs, instructor_owns_group
from apps.common.visibility import instructor_can_view_all

from .models import Class
from .serializers import ClassSerializer, ClassWriteSerializer, RecurringClassSerializer
from .services import apply_class_filters


def _instructor_assigned_ids(user) -> frozenset:
    """Return frozenset of string group IDs assigned to this instructor."""
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    return frozenset(
        str(pk)
        for pk in GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    )


class ClassViewSet(ViewSet):
    serializer_class = ClassSerializer

    _INSTRUCTOR_DENIED = {
        "errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}],
        "data": None,
    }

    def get_permissions(self):
        if self.action in {"create", "partial_update", "destroy"}:
            return [IsAdminOrInstructor()]
        return [IsAuthenticated()]

    def _base_queryset(self) -> object:
        from django.db.models import Prefetch  # noqa: PLC0415
        from apps.assignments.models import AssignmentTask  # noqa: PLC0415
        from apps.groups.models import GroupInstructor  # noqa: PLC0415
        return (
            Class.objects
            .select_related("group", "created_by")
            .prefetch_related(
                Prefetch(
                    "group__instructors",
                    queryset=GroupInstructor.objects.select_related("instructor"),
                ),
                Prefetch(
                    "tasks",
                    queryset=AssignmentTask.objects.order_by("upload_open_at"),
                    to_attr="prefetched_tasks",
                ),
            )
        )

    def _scoped_queryset(self, request: Request) -> object:
        qs = self._base_queryset()
        if request.user.role == "PARTICIPANT":
            qs = qs.filter(group__memberships__user=request.user).distinct()
        elif request.user.role == "INSTRUCTOR":
            if instructor_can_view_all(request.user):
                pass  # full superset; read_only flag computed per-row in serializer
            else:
                from django.db.models import Prefetch  # noqa: PLC0415
                from apps.assignments.models import AssignmentTask  # noqa: PLC0415
                from apps.groups.models import GroupInstructor  # noqa: PLC0415
                qs = (
                    instructor_class_qs(request.user)
                    .select_related("group", "created_by")
                    .prefetch_related(
                        Prefetch(
                            "group__instructors",
                            queryset=GroupInstructor.objects.select_related("instructor"),
                        ),
                        Prefetch(
                            "tasks",
                            queryset=AssignmentTask.objects.order_by("upload_open_at"),
                            to_attr="prefetched_tasks",
                        ),
                    )
                )
        return qs

    def list(self, request: Request) -> Response:
        qs = self._scoped_queryset(request)
        qs = apply_class_filters(qs, request.query_params)
        context: dict = {"request": request}
        if request.user.role == "INSTRUCTOR":
            context["assigned_group_ids"] = _instructor_assigned_ids(request.user)
        try:
            page_size = min(int(request.query_params.get("page_size", 50)), 200)
            page = max(int(request.query_params.get("page", 1)), 1)
        except (ValueError, TypeError):
            page_size, page = 50, 1
        offset = (page - 1) * page_size
        total = qs.count()
        items = qs[offset:offset + page_size]
        return Response({
            "data": ClassSerializer(items, many=True, context=context).data,
            "meta": {"total": total, "page": page, "page_size": page_size},
        })

    def create(self, request: Request) -> Response:
        if request.user.role == "INSTRUCTOR":
            group_id = request.data.get("group_id")
            if not group_id or not instructor_owns_group(request.user, group_id):
                return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        serializer = ClassWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Belt-and-suspenders: run model-level clean() before the DB write.
        from django.core.exceptions import ValidationError as DjangoValidationError  # noqa: PLC0415
        from rest_framework.exceptions import ValidationError as DRFValidationError  # noqa: PLC0415
        _attrs = {k: v for k, v in serializer.validated_data.items()}
        _attrs["created_by"] = request.user
        _tmp = Class(**_attrs)
        try:
            _tmp.full_clean(exclude=["id", "status_cached"])
        except DjangoValidationError as exc:
            raise DRFValidationError(detail=exc.message_dict)
        cls = serializer.save(created_by=request.user)
        log_action(
            actor=request.user,
            action="class.created",
            target_type="Class",
            target_id=cls.id,
            metadata={"title": cls.title, "group_id": str(cls.group_id)},
        )
        cls_fresh = get_object_or_404(Class.objects.select_related("group", "created_by"), pk=cls.pk)
        from .tasks import notify_class_scheduled
        notify_class_scheduled(cls_fresh)
        # Notify instructors assigned to this group (exclude the creator)
        from apps.notifications.services import notify_instructors as _notify_instructors  # noqa: PLC0415
        _starts_str = cls_fresh.starts_at.strftime("%d %b %Y, %I:%M %p")
        _notify_instructors(
            group=cls_fresh.group,
            notification_type="CLASS_SCHEDULED_BY_ADMIN",
            title=f"New class scheduled: {cls_fresh.title}",
            body=(
                f"{request.user.full_name or request.user.email} scheduled"
                f' "{cls_fresh.title}" in {cls_fresh.group.name} on {_starts_str}.'
            ),
            link=f"/instructor/classes/{cls_fresh.id}",
            payload={"class_id": str(cls_fresh.id), "group_id": str(cls_fresh.group_id)},
            actor=request.user,
            dedupe_suffix=str(cls_fresh.id),
        )
        return Response(
            {"data": ClassSerializer(cls_fresh, context={"request": request}).data},
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        qs = self._scoped_queryset(request)
        cls = get_object_or_404(qs, pk=pk)
        context: dict = {"request": request}
        if request.user.role == "INSTRUCTOR":
            context["assigned_group_ids"] = _instructor_assigned_ids(request.user)
        return Response({"data": ClassSerializer(cls, context=context).data})

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        cls = get_object_or_404(Class.objects.select_related("group", "created_by"), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, cls.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        serializer = ClassWriteSerializer(cls, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # When the admin reschedules a COMPLETED class (changes starts_at or ends_at)
        # without explicitly setting a new status, reset status_cached so it re-derives
        # from the new times instead of staying stuck at COMPLETED.
        time_changed = "starts_at" in serializer.validated_data or "ends_at" in serializer.validated_data
        if (
            time_changed
            and "status_cached" not in serializer.validated_data
            and cls.status_cached == Class.STATUS_COMPLETED
        ):
            serializer.validated_data["status_cached"] = Class.STATUS_UPCOMING

        # Belt-and-suspenders: apply pending changes to a scratch copy and run
        # model-level clean() before committing the DB write.
        from django.core.exceptions import ValidationError as DjangoValidationError  # noqa: PLC0415
        from rest_framework.exceptions import ValidationError as DRFValidationError  # noqa: PLC0415
        for _field, _val in serializer.validated_data.items():
            setattr(cls, _field, _val)
        try:
            cls.full_clean(exclude=["id"])
        except DjangoValidationError as exc:
            raise DRFValidationError(detail=exc.message_dict)

        cls = serializer.save()
        log_action(
            actor=request.user,
            action="class.updated",
            target_type="Class",
            target_id=cls.id,
            metadata={"title": cls.title},
        )
        cls_fresh = get_object_or_404(Class.objects.select_related("group", "created_by"), pk=cls.pk)

        # Notify group members when the class is rescheduled
        from django.utils import timezone as _tz2  # noqa: PLC0415
        from apps.notifications.services import notify_instructors as _ni2  # noqa: PLC0415
        if time_changed:
            from apps.groups.models import GroupMembership
            from apps.notifications.models import Notification
            now2 = _tz2.now()
            starts_str = cls_fresh.starts_at.strftime("%d %b %Y, %I:%M %p")
            member_ids = list(
                GroupMembership.objects.filter(group_id=cls_fresh.group_id)
                .values_list("user_id", flat=True)
            )
            Notification.objects.bulk_create(
                [
                    Notification(
                        user_id=uid,
                        type="CLASS_RESCHEDULED",
                        title=f"Class rescheduled: {cls_fresh.title}",
                        body=f'"{cls_fresh.title}" has been moved to {starts_str} in {cls_fresh.group.name}.',
                        link=f"/me/classes/{cls_fresh.id}",
                        dedupe_key=f"class_rescheduled:{cls_fresh.id}:{starts_str}:{uid}",
                        sent_at=now2,
                        payload={"class_id": str(cls_fresh.id)},
                    )
                    for uid in member_ids
                ],
                ignore_conflicts=True,
                batch_size=500,
            )
            # Notify instructors about reschedule
            _ni2(
                group=cls_fresh.group,
                notification_type="CLASS_RESCHEDULED",
                title=f"Class rescheduled: {cls_fresh.title}",
                body=f'"{cls_fresh.title}" has been rescheduled to {starts_str}.',
                link=f"/instructor/classes/{cls_fresh.id}",
                payload={"class_id": str(cls_fresh.id)},
                actor=request.user,
                dedupe_suffix=f"reschedule:{starts_str}",
            )
        else:
            # Content-only edit by a co-instructor → CO_INSTRUCTOR_EDITED_CLASS (debounced per 5 min)
            if request.user.role == "INSTRUCTOR":
                debounce_window = _tz2.now().strftime("%Y%m%d%H") + str(_tz2.now().minute // 5)
                _ni2(
                    group=cls_fresh.group,
                    notification_type="CO_INSTRUCTOR_EDITED_CLASS",
                    title=f"Class updated: {cls_fresh.title}",
                    body=(
                        f"{request.user.full_name or request.user.email}"
                        f' updated class "{cls_fresh.title}".'
                    ),
                    link=f"/instructor/classes/{cls_fresh.id}",
                    payload={"class_id": str(cls_fresh.id), "actor_id": str(request.user.id)},
                    actor=request.user,
                    dedupe_suffix=f"edit:{debounce_window}",
                )

        return Response({"data": ClassSerializer(cls_fresh, context={"request": request}).data})

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        cls = get_object_or_404(Class.objects.select_related("group"), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, cls.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        title = cls.title
        class_id = cls.id
        group = cls.group
        date_str = cls.starts_at.strftime("%d %b %Y")
        cls.delete()
        log_action(
            actor=request.user,
            action="class.deleted",
            target_type="Class",
            target_id=class_id,
            metadata={"title": title},
        )
        from apps.notifications.services import notify_instructors as _ni3  # noqa: PLC0415
        _ni3(
            group=group,
            notification_type="CLASS_CANCELLED",
            title=f"Class cancelled: {title}",
            body=f'Class "{title}" on {date_str} has been cancelled.',
            link=f"/instructor/groups/{group.id}",
            payload={"group_id": str(group.id)},
            actor=request.user,
            dedupe_suffix=f"cancel:{class_id}",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(exclude=True)
class ParticipantCalendarView(APIView):
    """GET /api/v1/me/calendar — participant's own classes across all groups."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = (
            Class.objects.select_related("group", "created_by")
            .prefetch_related("tasks")
            .filter(group__memberships__user=request.user)
            .distinct()
        )
        qs = apply_class_filters(qs, request.query_params)
        return Response({"data": ClassSerializer(qs, many=True, context={"request": request}).data})


@extend_schema(exclude=True)
class ClassParticipantsView(APIView):
    """GET /classes/{pk}/participants — list participants in the class's group."""

    permission_classes = [IsAdminOrInstructor]

    def get(self, request: Request, pk: str) -> Response:
        from apps.groups.models import GroupMembership  # noqa: PLC0415

        cls = get_object_or_404(Class.objects.select_related("group"), pk=pk)
        members = (
            GroupMembership.objects
            .filter(group=cls.group, user__is_active=True)
            .select_related("user")
            .order_by("user__full_name", "user__email")
        )
        data = [
            {
                "id": str(m.user_id),
                "full_name": m.user.full_name,
                "email": m.user.email,
            }
            for m in members
        ]
        return Response({"data": data})



@extend_schema(exclude=True)
class RecurringClassView(APIView):
    """POST /classes/recurring — bulk-create classes for repeating weekdays in a date range."""

    permission_classes = [IsAdminOrInstructor]

    def post(self, request: Request) -> Response:
        from datetime import datetime, timedelta  # noqa: PLC0415
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError  # noqa: PLC0415
        from django.utils import timezone as _tz  # noqa: PLC0415

        if request.user.role == "INSTRUCTOR":
            group_id = request.data.get("group_id")
            if not group_id or not instructor_owns_group(request.user, group_id):
                return Response(
                    {"errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}]},
                    status=status.HTTP_403_FORBIDDEN,
                )

        ser = RecurringClassSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        group     = d["group_id"]
        sub_group = d.get("sub_group_id")
        days_set  = set(d["days_of_week"])

        # Resolve timezone: use system setting, fall back to UTC
        try:
            from apps.common.models import SystemSettings  # noqa: PLC0415
            tz = ZoneInfo(SystemSettings.get_solo().timezone)
        except (ZoneInfoNotFoundError, Exception):
            tz = ZoneInfo("UTC")

        # Collect all matching dates in the range
        matching: list[datetime] = []
        cur = d["start_date"]
        while cur <= d["end_date"]:
            if cur.weekday() in days_set:
                matching.append(cur)
            cur += timedelta(days=1)

        if not matching:
            return Response(
                {"errors": [{"code": "recurring.no_dates", "message": "No matching dates found in the selected range."}]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(matching) > 100:
            return Response(
                {"errors": [{"code": "recurring.too_many", "message": f"This would create {len(matching)} classes. Maximum allowed is 100 per request."}]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        classes_to_create = []
        for day in matching:
            from django.utils.timezone import AmbiguousTimeError, NonExistentTimeError  # noqa: PLC0415
            try:
                starts_at = _tz.make_aware(datetime.combine(day, d["start_time"]), tz)
            except (AmbiguousTimeError, NonExistentTimeError):
                starts_at = _tz.make_aware(
                    datetime.combine(day, d["start_time"]) + timedelta(hours=1), tz
                )
            try:
                ends_at = _tz.make_aware(datetime.combine(day, d["end_time"]), tz)
            except (AmbiguousTimeError, NonExistentTimeError):
                ends_at = _tz.make_aware(
                    datetime.combine(day, d["end_time"]) + timedelta(hours=1), tz
                )
            classes_to_create.append(
                Class(
                    group=group,
                    sub_group=sub_group,
                    title=d["title"],
                    description=d.get("description", ""),
                    meeting_link=d.get("meeting_link", ""),
                    allow_late_attendance=d["allow_late_attendance"],
                    starts_at=starts_at,
                    ends_at=ends_at,
                    created_by=request.user,
                )
            )

        created = Class.objects.bulk_create(classes_to_create)

        log_action(
            actor=request.user,
            action="class.recurring_created",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={
                "title": d["title"],
                "group_id": str(group.id),
                "count": len(created),
                "days_of_week": list(days_set),
                "start_date": d["start_date"].isoformat(),
                "end_date": d["end_date"].isoformat(),
            },
        )

        return Response(
            {"data": {"created": len(created), "dates": [c.starts_at.date().isoformat() for c in created]}},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(exclude=True)
class ClassActivityView(APIView):
    """GET /classes/{pk}/activity — audit trail for a class (admin + instructor)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: str) -> Response:
        from django.db.models import Q  # noqa: PLC0415
        from apps.audit.models import AuditLog  # noqa: PLC0415
        from apps.audit.serializers import AuditLogSerializer  # noqa: PLC0415
        from apps.attendance.models import AttendanceSession  # noqa: PLC0415
        from apps.assignments.models import AssignmentTask  # noqa: PLC0415

        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.denied", "message": "Access denied."}]},
                status=status.HTTP_403_FORBIDDEN,
            )

        cls = get_object_or_404(Class, pk=pk)

        if request.user.role == "INSTRUCTOR":
            from apps.common.visibility import instructor_can_view_all  # noqa: PLC0415
            if not instructor_owns_group(request.user, cls.group_id) and not instructor_can_view_all(request.user):
                return Response(
                    {"errors": [{"code": "perm.not_instructor_of_group", "message": "Not your group."}]},
                    status=status.HTTP_403_FORBIDDEN,
                )

        class_id_str = str(cls.id)

        session_ids = list(
            AttendanceSession.objects.filter(class_obj_id=cls.id).values_list("id", flat=True)
        )
        session_id_strs = [str(s) for s in session_ids]

        task_ids = list(
            AssignmentTask.objects.filter(class_obj_id=cls.id).values_list("id", flat=True)
        )
        task_id_strs = [str(t) for t in task_ids]

        q = Q(target_type="Class", target_id=class_id_str)
        if session_id_strs:
            q |= Q(target_type="AttendanceSession", target_id__in=session_id_strs)
            q |= Q(target_type="AttendanceRecord", metadata__session_id__in=session_id_strs)
        if task_id_strs:
            q |= Q(target_type="AssignmentTask", target_id__in=task_id_strs)
        q |= Q(target_type="SubmissionReview", metadata__class_id=class_id_str)

        entries = (
            AuditLog.objects.filter(q)
            .select_related("actor")
            .order_by("-created_at")[:100]
        )

        return Response({"data": AuditLogSerializer(entries, many=True).data})
