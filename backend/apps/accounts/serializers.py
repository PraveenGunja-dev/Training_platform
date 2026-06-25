from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    admin_of_group_ids = serializers.SerializerMethodField()

    def get_admin_of_group_ids(self, obj):
        from apps.groups.models import GroupAdmin  # noqa: PLC0415
        return [str(ga.group_id) for ga in GroupAdmin.objects.filter(admin=obj).only("group_id")]

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "role", "photo_url", "is_active", "created_at", "last_login", "must_change_password", "business_unit", "grade_code", "department", "employee_code", "admin_of_group_ids")
        read_only_fields = ("id", "email", "role", "created_at", "last_login")


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("full_name",)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        return value.lower()


class SetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value


class ChangeEmailSerializer(serializers.Serializer):
    current_email = serializers.EmailField()
    new_email = serializers.EmailField()
    current_password = serializers.CharField(write_only=True)

    def validate_current_email(self, value: str) -> str:
        return value.lower()

    def validate_new_email(self, value: str) -> str:
        return value.lower()
