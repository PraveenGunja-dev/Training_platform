from rest_framework import serializers

from apps.accounts.models import User


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "created_at", "last_login", "must_change_password", "business_unit", "grade_code", "department", "employee_code"]


class UserDetailSerializer(serializers.ModelSerializer):
    groups = serializers.SerializerMethodField()
    admin_of_group = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "created_at", "last_login", "must_change_password", "groups", "admin_of_group", "business_unit", "grade_code", "department", "employee_code", "can_view_all_classes"]

    def get_groups(self, obj: User) -> list:
        return list(
            obj.group_memberships.select_related("group").values("group__id", "group__name")
        )

    def get_admin_of_group(self, obj: User) -> dict | None:
        from apps.groups.models import GroupAdmin  # noqa: PLC0415
        ga = GroupAdmin.objects.filter(admin=obj).select_related("group").first()
        if ga is None:
            return None
        return {"id": str(ga.group_id), "name": ga.group.name}


class UserWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "role", "is_active", "business_unit", "grade_code", "department", "employee_code"]


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(choices=["ADMIN", "INSTRUCTOR", "PARTICIPANT", "GROUP_ADMIN"])

    def validate_email(self, value: str) -> str:
        return value.lower()


class BulkInviteRowSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")

    def validate_email(self, value: str) -> str:
        return value.lower()
    role = serializers.ChoiceField(choices=["ADMIN", "INSTRUCTOR", "PARTICIPANT", "GROUP_ADMIN"])


class BulkInviteSerializer(serializers.Serializer):
    rows = BulkInviteRowSerializer(many=True)

    def validate_rows(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError("At least one row required.")
        if len(value) > 200:
            raise serializers.ValidationError("Max 200 rows per bulk invite.")
        return value


class InstructorListSerializer(serializers.ModelSerializer):
    """Minimal serializer for the instructor picker (GET /instructors)."""

    class Meta:
        model = User
        fields = ["id", "email", "full_name"]


class UserVisibilityUpdateSerializer(serializers.Serializer):
    """Write serializer for PATCH /users/{id}/visibility.

    Accepts null (inherit system default), true (always view all), false (never).
    """

    can_view_all_classes = serializers.BooleanField(allow_null=True, required=True)
