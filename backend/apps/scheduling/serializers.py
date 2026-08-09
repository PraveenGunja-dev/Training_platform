from __future__ import annotations

from rest_framework import serializers

from apps.groups.models import ClassGroup, SubGroup

from .models import Class


class ClassSerializer(serializers.ModelSerializer):
    """Read serializer — matches the frontend Class contract exactly."""

    group_id = serializers.UUIDField(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    group_location = serializers.CharField(source="group.location", read_only=True, default="")
    # Use computed_status (time-based property) so the API always reflects reality
    # even if status_cached is stale (e.g. Celery beat not running in dev).
    status = serializers.CharField(source="computed_status", read_only=True)
    participants_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    active_session = serializers.SerializerMethodField()
    my_record = serializers.SerializerMethodField()
    last_session = serializers.SerializerMethodField()
    related_tasks = serializers.SerializerMethodField()
    sub_mentors = serializers.SerializerMethodField()
    lead_mentor = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = [
            "id",
            "group_id",
            "group_name",
            "group_location",
            "title",
            "description",
            "meeting_link",
            "sub_group_id",
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
            "sub_mentors",
            "lead_mentor",
        ]

    def get_participants_count(self, obj: Class) -> int:
        if obj.sub_group_id:
            from apps.groups.models import SubGroupMembership  # noqa: PLC0415
            return SubGroupMembership.objects.filter(sub_group_id=obj.sub_group_id).count()
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
        if not request or not request.user.is_authenticated:
            return None
        if request.user.role != "PARTICIPANT":
            return None
        from apps.attendance.models import AttendanceRecord  # noqa: PLC0415
        record = (
            AttendanceRecord.objects
            .filter(user=request.user, session__class_obj=obj)
            .select_related("session")
            .order_by("-session__started_at")
            .first()
        )
        if not record:
            return None
        return {
            "session_id": str(record.session_id),
            "marked_at": record.marked_at.isoformat() if record.marked_at else None,
        }

    def get_related_tasks(self, obj: Class) -> list:
        tasks = getattr(obj, "prefetched_tasks", None)
        if tasks is None:
            from apps.assignments.models import AssignmentTask  # noqa: PLC0415
            tasks = AssignmentTask.objects.filter(class_obj=obj).order_by("upload_open_at")
        return [
            {
                "id": str(t.id),
                "title": t.title,
                "is_open": t.is_open,
                "is_closed": t.is_closed,
                "upload_open_at": t.upload_open_at.isoformat() if t.upload_open_at else None,
                "deadline_at": t.deadline_at.isoformat() if t.deadline_at else None,
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

    def get_sub_mentors(self, obj: Class) -> list:
        return [
            {
                "id": str(gi.sub_mentor_id),
                "full_name": gi.sub_mentor.full_name,
                "email": gi.sub_mentor.email,
            }
            for gi in obj.group.sub_mentors.all()
        ]

    def get_lead_mentor(self, obj: Class) -> dict | None:
        glm = getattr(obj.group, "lead_mentor_assignment", None)
        if glm is None or glm.lead_mentor is None:
            return None
        return {
            "id": str(glm.lead_mentor_id),
            "full_name": glm.lead_mentor.full_name,
            "email": glm.lead_mentor.email,
        }

    def to_representation(self, instance: Class) -> dict:
        data = super().to_representation(instance)
        # Cross-visibility: inject read_only flag computed from context.
        # assigned_group_ids is a frozenset of string group IDs set by ClassViewSet
        # for SUB_MENTOR users. Absent (Admin/Participant path) → always False.
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
    sub_group_id = serializers.PrimaryKeyRelatedField(
        source='sub_group',
        queryset=SubGroup.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = Class
        fields = [
            "group_id", "title", "description", "meeting_link", "sub_group_id",
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
        # ── Status transition enforcement ──────────────────────────────────────
        new_status = attrs.get("status_cached")
        if new_status and self.instance:
            old_status = self.instance.status_cached
            request = self.context.get("request")
            is_admin = request and getattr(request.user, "role", None) == "ADMIN"
            TERMINAL = {Class.STATUS_CANCELLED, Class.STATUS_COMPLETED}
            if old_status in TERMINAL and not is_admin:
                raise serializers.ValidationError(
                    {"status_cached": f"Cannot change status from {old_status}."}
                )

        # ── Time ordering (partial-update safe) ────────────────────────────────
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at   = attrs.get("ends_at",   getattr(self.instance, "ends_at",   None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError(
                {"ends_at": "End time must be after start time."}
            )

        # ── Attendance window checks ───────────────────────────────────────────
        open_at  = attrs.get("attendance_open_at")
        close_at = attrs.get("attendance_close_at")
        if open_at and starts_at and open_at >= starts_at:
            raise serializers.ValidationError(
                {"attendance_open_at": "Must be before class start time."}
            )
        if close_at and starts_at and close_at <= starts_at:
            raise serializers.ValidationError(
                {"attendance_close_at": "Must be after class start time."}
            )

        # ── Sub-group / parent-group cross-check (partial-update safe) ─────────
        sub_group = attrs.get("sub_group", getattr(self.instance, "sub_group", None))
        group     = attrs.get("group",     getattr(self.instance, "group",     None))
        if sub_group and group and str(sub_group.parent_group_id) != str(group.id):
            raise serializers.ValidationError(
                {"sub_group_id": "Sub-group does not belong to the selected group."}
            )

        return attrs


class RecurringClassSerializer(serializers.Serializer):
    """Validates a bulk recurring-class creation request."""

    group_id = serializers.PrimaryKeyRelatedField(queryset=ClassGroup.objects.all())
    sub_group_id = serializers.PrimaryKeyRelatedField(
        queryset=SubGroup.objects.all(), required=False, allow_null=True, default=None,
    )
    title = serializers.CharField(max_length=300)
    description = serializers.CharField(default="", allow_blank=True, required=False)
    meeting_link = serializers.URLField(required=False, allow_blank=True, default="")
    allow_late_attendance = serializers.BooleanField(default=False)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    # 0=Monday … 6=Sunday (Python weekday())
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        min_length=1,
        max_length=7,
    )
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()

    def validate(self, data: dict) -> dict:
        if data["end_date"] < data["start_date"]:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        if data["end_time"] <= data["start_time"]:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        if (data["end_date"] - data["start_date"]).days > 365:
            raise serializers.ValidationError("Date range cannot exceed 1 year.")
        sub_group = data.get("sub_group_id")
        if sub_group and str(sub_group.parent_group_id) != str(data["group_id"].id):
            raise serializers.ValidationError({"sub_group_id": "Sub-group does not belong to the selected group."})
        return data
