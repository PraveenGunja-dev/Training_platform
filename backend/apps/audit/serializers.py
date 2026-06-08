from rest_framework import serializers

from .models import AuditLog


class ActorSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    email = serializers.EmailField()


class AuditLogSerializer(serializers.ModelSerializer):
    actor = ActorSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "action", "target_type", "target_id", "metadata", "created_at"]
