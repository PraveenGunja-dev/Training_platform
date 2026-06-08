from __future__ import annotations

from rest_framework import serializers

from .models import AttendanceRecord, AttendanceSession


class AttendanceSessionSerializer(serializers.ModelSerializer):
    """Read serializer — matches the frontend AttendanceSession contract exactly."""

    class_id = serializers.UUIDField(source="class_obj_id", read_only=True)
    class_title = serializers.CharField(source="class_obj.title", read_only=True)
    group_id = serializers.UUIDField(source="class_obj.group_id", read_only=True)
    started_by = serializers.SerializerMethodField()
    ended_by = serializers.SerializerMethodField()
    # Populated via queryset annotation (listSessions); None when not annotated.
    present_count = serializers.SerializerMethodField()
    absent_count = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "class_id",
            "class_title",
            "group_id",
            "started_at",
            "started_by",
            "ended_at",
            "ended_by",
            "status",
            "duration_minutes",
            "scheduled_end_at",
            "present_count",
            "absent_count",
        ]

    def get_started_by(self, obj: AttendanceSession) -> dict:
        return {"id": str(obj.started_by.id), "full_name": obj.started_by.full_name}

    def get_ended_by(self, obj: AttendanceSession) -> dict | None:
        if obj.ended_by is None:
            return None
        return {"id": str(obj.ended_by.id), "full_name": obj.ended_by.full_name}

    def get_present_count(self, obj: AttendanceSession) -> int | None:
        return getattr(obj, "present_count", None)

    def get_absent_count(self, obj: AttendanceSession) -> int | None:
        return getattr(obj, "absent_count", None)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Read serializer — matches the frontend AttendanceRecord contract exactly."""

    session_id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ["id", "session_id", "user_id", "marked_at", "status"]
