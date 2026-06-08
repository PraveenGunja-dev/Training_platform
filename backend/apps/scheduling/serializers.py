from __future__ import annotations

from rest_framework import serializers

from apps.groups.models import ClassGroup

from .models import Class


class ClassSerializer(serializers.ModelSerializer):
    """Read serializer — matches the frontend Class contract exactly."""

    group_id = serializers.UUIDField(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    # Use computed_status (time-based property) so the API always reflects reality
    # even if status_cached is stale (e.g. Celery beat not running in dev).
    status = serializers.CharField(source="computed_status", read_only=True)
    participants_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    active_session = serializers.SerializerMethodField()
    my_record = serializers.SerializerMethodField()
    last_session = serializers.SerializerMethodField()
    related_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = [
            "id",
            "group_id",
            "group_name",
            "title",
            "description",
            "meeting_link",
            "starts_at",
            "ends_at",
            "status",
            "attendance_open_at",
            "attendance_close_at",
            "allow_late_attendance",
            "participants_count",
            "created_by_name",
            "active_session",
            "my_record",
            "last_session",
            "related_tasks",
        ]

    def get_participants_count(self, obj: Class) -> int:
        from apps.groups.models import GroupMembership
        return GroupMembership.objects.filter(group=obj.group).count()

    def get_created_by_name(self, obj: Class) -> str | None:
        return obj.created_by.full_name if obj.created_by else None

    def get_active_session(self, obj: Class) -> dict | None:
        try:
            from apps.attendance.models import AttendanceSession  # type: ignore[import]  # noqa: PLC0415
            from apps.attendance.services import maybe_end_expired_session  # noqa: PLC0415
        except ImportError:
            return None
        session = (
            AttendanceSession.objects.select_related("started_by", "ended_by")
            .filter(class_obj=obj, status="ACTIVE")
            .first()
        )
        if session is None:
            return None
        session = maybe_end_expired_session(session)
        if session.status != "ACTIVE":
            return None
        return {
            "id": str(session.id),
            "class_id": str(obj.id),
            "class_title": obj.title,
            "group_id": str(obj.group_id),
            "started_at": session.started_at.isoformat(),
            "started_by": {
                "id": str(session.started_by.id),
                "full_name": session.started_by.full_name,
            },
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "ended_by": (
                {
                    "id": str(session.ended_by.id),
                    "full_name": session.ended_by.full_name,
                }
                if session.ended_by
                else None
            ),
            "status": session.status,
            "duration_minutes": session.duration_minutes,
            "scheduled_end_at": session.scheduled_end_at.isoformat() if session.scheduled_end_at else None,
        }

    def get_my_record(self, obj: Class) -> dict | None:
        request = self.context.get("request")
        if request is None or not hasattr(request.user, "role") or request.user.role != "PARTICIPANT":
            return None
        try:
            from apps.attendance.models import AttendanceRecord, AttendanceSession  # type: ignore[import]  # noqa: PLC0415
        except ImportError:
            return None
        session = AttendanceSession.objects.filter(class_obj=obj, status="ACTIVE").first()
        if session is None:
            return None
        record = AttendanceRecord.objects.filter(session=session, user=request.user).first()
        if record is None:
            return None
        return {
            "id": str(record.id),
            "session_id": str(record.session_id),
            "user_id": str(record.user_id),
            "marked_at": record.marked_at.isoformat(),
            "status": record.status,
        }

    def get_related_tasks(self, obj: Class) -> list:
        from apps.assignments.models import AssignmentTask  # noqa: PLC0415
        tasks = AssignmentTask.objects.filter(class_obj=obj).order_by("upload_open_at")
        return [
            {
                "id": str(t.id),
                "title": t.title,
                "is_open": t.is_open,
                "is_closed": t.is_closed,
                "upload_open_at": t.upload_open_at.isoformat(),
                "deadline_at": t.deadline_at.isoformat(),
            }
            for t in tasks
        ]

    def get_last_session(self, obj: Class) -> dict | None:
        try:
            from apps.attendance.models import AttendanceSession  # noqa: PLC0415
        except ImportError:
            return None
        session = (
            AttendanceSession.objects.select_related("started_by", "ended_by")
            .filter(class_obj=obj)
            .order_by("-started_at")
            .first()
        )
        if session is None:
            return None
        return {
            "id": str(session.id),
            "status": session.status,
            "started_at": session.started_at.isoformat(),
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "duration_minutes": session.duration_minutes,
            "scheduled_end_at": session.scheduled_end_at.isoformat() if session.scheduled_end_at else None,
        }

    def to_representation(self, instance: Class) -> dict:
        data = super().to_representation(instance)
        # Cross-visibility: inject read_only flag computed from context.
        # assigned_group_ids is a frozenset of string group IDs set by ClassViewSet
        # for INSTRUCTOR users. Absent (Admin/Participant path) → always False.
        assigned_ids = self.context.get("assigned_group_ids")
        data["read_only"] = False if assigned_ids is None else str(instance.group_id) not in assigned_ids
        return data


class ClassWriteSerializer(serializers.ModelSerializer):
    """Write serializer for create / partial-update. Accepts `group_id` and optional `status`."""

    group_id = serializers.PrimaryKeyRelatedField(
        source="group",
        queryset=ClassGroup.objects.all(),
    )
    status = serializers.ChoiceField(
        choices=Class.STATUS_CHOICES,
        source="status_cached",
        required=False,
    )

    meeting_link = serializers.URLField(allow_blank=True, required=False, default="")

    class Meta:
        model = Class
        fields = [
            "group_id", "title", "description", "meeting_link",
            "starts_at", "ends_at", "status",
            "attendance_open_at", "attendance_close_at", "allow_late_attendance",
        ]
        extra_kwargs = {
            "description": {"required": False},
            "attendance_open_at": {"required": False},
            "attendance_close_at": {"required": False},
            "allow_late_attendance": {"required": False},
        }

    def validate(self, attrs: dict) -> dict:
        starts_at = attrs.get("starts_at")
        open_at = attrs.get("attendance_open_at")
        close_at = attrs.get("attendance_close_at")
        if open_at and starts_at and open_at >= starts_at:
            raise serializers.ValidationError(
                {"attendance_open_at": "Must be before class start time."}
            )
        if close_at and starts_at and close_at <= starts_at:
            raise serializers.ValidationError(
                {"attendance_close_at": "Must be after class start time."}
            )
        return attrs
