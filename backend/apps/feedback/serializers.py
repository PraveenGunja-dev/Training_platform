from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import ClassFeedback


class ClassFeedbackWriteSerializer(serializers.Serializer):
    """Input serializer for POST /feedback/submit/"""

    class_session_id = serializers.UUIDField()
    rating = serializers.DecimalField(max_digits=3, decimal_places=1)
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)

    def validate_rating(self, value: Decimal) -> Decimal:
        if value < Decimal("1.0") or value > Decimal("5.0"):
            raise serializers.ValidationError("Rating must be between 1.0 and 5.0.")
        if (value * 2) % 1 != 0:
            raise serializers.ValidationError("Rating must be a multiple of 0.5.")
        return value


class ClassFeedbackReadSerializer(serializers.ModelSerializer):
    """Output serializer for all read endpoints."""

    class_session_id = serializers.UUIDField(read_only=True)
    participant_name = serializers.SerializerMethodField()

    class Meta:
        model = ClassFeedback
        fields = [
            "id",
            "class_session_id",
            "participant_name",
            "rating",
            "comment",
            "submitted_at",
        ]

    def get_participant_name(self, obj: ClassFeedback) -> str:
        if obj.participant is None:
            return "Deleted User"
        return obj.participant.full_name or obj.participant.email
