from __future__ import annotations

import re

from rest_framework import serializers

from .models import SystemSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            "product_name",
            "timezone",
            "brand_color",
            "doc_max_mb",
            "image_max_mb",
            "video_max_mb",
            "reminder_offsets",
            "session_lifetime_hours",
            "instructors_can_view_all_classes",
        ]

    def validate_brand_color(self, value: str) -> str:
        if not re.match(r"^#[0-9A-Fa-f]{6}$", value):
            raise serializers.ValidationError("Must be a valid hex colour e.g. #4F46E5.")
        return value
