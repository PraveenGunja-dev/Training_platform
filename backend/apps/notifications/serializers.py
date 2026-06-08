from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "type", "channel", "title", "body", "link",
            "status", "read_at", "sent_at", "payload", "created_at",
        ]
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["in_app_enabled", "email_enabled", "digest_submissions"]
        read_only_fields = ["in_app_enabled"]
