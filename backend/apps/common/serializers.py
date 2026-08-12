from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from .models import SystemSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            "timezone",
            "reminder_offsets",
            "session_lifetime_hours",
            "sub_mentors_can_view_all_classes",
            "attendance_drift_threshold_minutes",
        ]

    def validate_timezone(self, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, KeyError):
            raise serializers.ValidationError(f"'{value}' is not a valid IANA timezone.")
        return value
