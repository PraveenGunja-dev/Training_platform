from __future__ import annotations

from rest_framework import serializers

from .models import SystemSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            "timezone",
            "doc_max_mb",
            "image_max_mb",
            "video_max_mb",
            "reminder_offsets",
            "session_lifetime_hours",
            "sub_mentors_can_view_all_classes",
        ]
