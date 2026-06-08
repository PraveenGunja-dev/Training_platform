from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ClassGroup, GroupInstructor

User = get_user_model()


class ClassGroupListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()

    instructors = serializers.SerializerMethodField()

    class Meta:
        model = ClassGroup
        fields = [
            "id",
            "name",
            "description",
            "is_archived",
            "created_by",
            "created_by_name",
            "participants_count",
            "instructors",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj: ClassGroup) -> str | None:
        return obj.created_by.full_name if obj.created_by else None

    def get_participants_count(self, obj: ClassGroup) -> int:
        return obj.memberships.count()

    def get_instructors(self, obj: ClassGroup) -> list:
        return [
            {"id": str(gi.instructor.id), "full_name": gi.instructor.full_name, "email": gi.instructor.email}
            for gi in obj.instructors.select_related("instructor").all()
        ]


class ClassGroupDetailSerializer(ClassGroupListSerializer):
    participants = serializers.SerializerMethodField()

    class Meta(ClassGroupListSerializer.Meta):
        fields = ClassGroupListSerializer.Meta.fields + ["participants"]

    def get_participants(self, obj: ClassGroup) -> list:
        return [
            {
                "id": str(m.user.id),
                "full_name": m.user.full_name,
                "email": m.user.email,
            }
            for m in obj.memberships.all()
        ]


class ClassGroupWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassGroup
        fields = ["name", "description", "is_archived"]
        extra_kwargs = {
            "description": {"required": False},
            "is_archived": {"required": False},
        }


class BulkAddParticipantsSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)


class GroupInstructorSerializer(serializers.ModelSerializer):
    """Read serializer — embeds minimal instructor user data."""

    id = serializers.UUIDField(source="instructor.id", read_only=True)
    full_name = serializers.CharField(source="instructor.full_name", read_only=True)
    email = serializers.EmailField(source="instructor.email", read_only=True)

    class Meta:
        model = GroupInstructor
        fields = ["id", "full_name", "email", "assigned_at"]


class GroupInstructorAssignSerializer(serializers.Serializer):
    """Write serializer — bulk assign instructors to a group by user IDs."""

    user_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)

    def validate_user_ids(self, value: list) -> list:
        found = User.objects.filter(id__in=value)
        found_ids = {u.id for u in found}
        missing = [uid for uid in value if uid not in found_ids]
        if missing:
            raise serializers.ValidationError(f"Users not found: {missing}.")
        non_instructors = found.exclude(role="INSTRUCTOR")
        if non_instructors.exists():
            emails = list(non_instructors.values_list("email", flat=True))
            raise serializers.ValidationError(
                f"The following users do not have the INSTRUCTOR role: {', '.join(emails)}."
            )
        return value
