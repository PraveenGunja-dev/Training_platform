from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ClassGroup, GroupAdmin, GroupInstructor, SubGroup, SubGroupMembership

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
            {
                "id": str(gi.instructor.id),
                "full_name": gi.instructor.full_name,
                "email": gi.instructor.email,
                "employee_code": gi.instructor.employee_code or "",
                "business_unit": gi.instructor.business_unit or "",
            }
            for gi in obj.instructors.select_related("instructor").all()
        ]


class ClassGroupDetailSerializer(ClassGroupListSerializer):
    participants = serializers.SerializerMethodField()
    group_admin = serializers.SerializerMethodField()

    class Meta(ClassGroupListSerializer.Meta):
        fields = ClassGroupListSerializer.Meta.fields + ["participants", "group_admin"]

    def get_participants(self, obj: ClassGroup) -> list:
        from apps.attendance.models import AttendanceRecord, AttendanceSession  # noqa: PLC0415
        from apps.assignments.models import AssignmentTask, Submission  # noqa: PLC0415
        from django.db.models import Count  # noqa: PLC0415

        total_sessions = AttendanceSession.objects.filter(class_obj__group=obj).count()
        open_tasks = AssignmentTask.objects.filter(group=obj, is_open=True).count()

        attendance_map = dict(
            AttendanceRecord.objects.filter(session__class_obj__group=obj)
            .values("user_id")
            .annotate(n=Count("id"))
            .values_list("user_id", "n")
        )
        submission_map = dict(
            Submission.objects.filter(task__group=obj)
            .values("user_id", "task_id")
            .distinct()
            .values("user_id")
            .annotate(n=Count("task_id", distinct=True))
            .values_list("user_id", "n")
        )

        result = []
        for m in obj.memberships.all():
            attended = attendance_map.get(m.user_id, 0)
            att_rate = round(min(attended / total_sessions * 100, 100), 1) if total_sessions else 0.0
            submitted = submission_map.get(m.user_id, 0)
            sub_rate = round(min(submitted / open_tasks * 100, 100), 1) if open_tasks else 0.0
            result.append({
                "id": str(m.user_id),
                "full_name": m.user.full_name,
                "email": m.user.email,
                "role": m.user.role,
                "is_active": m.user.is_active,
                "employee_code": m.user.employee_code or "",
                "business_unit": m.user.business_unit or "",
                "attendance_rate": att_rate,
                "submission_rate": sub_rate,
            })
        return result

    def get_group_admin(self, obj: ClassGroup):
        try:
            return GroupAdminSerializer(obj.group_admin).data
        except GroupAdmin.DoesNotExist:
            return None


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
    promote_participants = serializers.BooleanField(default=False, required=False)

    def validate_user_ids(self, value: list) -> list:
        found = User.objects.filter(id__in=value)
        found_ids = {u.id for u in found}
        missing = [uid for uid in value if uid not in found_ids]
        if missing:
            raise serializers.ValidationError(f"Users not found: {missing}.")
        return value

    def validate(self, attrs):
        promote = attrs.get("promote_participants", False)
        user_ids = attrs.get("user_ids", [])
        found = User.objects.filter(id__in=user_ids)
        if promote:
            blocked = found.filter(role__in=["ADMIN", "GROUP_ADMIN"])
            if blocked.exists():
                emails = list(blocked.values_list("email", flat=True))
                raise serializers.ValidationError(
                    {"user_ids": f"Cannot assign ADMIN or GROUP_ADMIN users as instructors: {', '.join(emails)}."}
                )
        else:
            non_instructors = found.exclude(role="INSTRUCTOR")
            if non_instructors.exists():
                emails = list(non_instructors.values_list("email", flat=True))
                raise serializers.ValidationError(
                    {"user_ids": f"The following users do not have the INSTRUCTOR role: {', '.join(emails)}."}
                )
        return attrs


class SubGroupSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()

    class Meta:
        model = SubGroup
        fields = ['id', 'name', 'parent_group', 'participants', 'participants_count', 'created_at']
        read_only_fields = ['id', 'parent_group', 'created_at']

    def get_participants(self, obj: SubGroup) -> list:
        return [
            {
                'id': str(m.user.id),
                'full_name': m.user.full_name,
                'email': m.user.email,
            }
            for m in obj.memberships.select_related('user').all()
        ]

    def get_participants_count(self, obj: SubGroup) -> int:
        return obj.memberships.count()


class SubGroupWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )

    def validate_name(self, value: str) -> str:
        return value.strip()


class GroupAdminSerializer(serializers.ModelSerializer):
    """Read serializer — returns admin user details."""
    admin_id = serializers.UUIDField(source="admin.id", read_only=True)
    full_name = serializers.CharField(source="admin.full_name", read_only=True)
    email = serializers.EmailField(source="admin.email", read_only=True)
    assigned_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = GroupAdmin
        fields = ["admin_id", "full_name", "email", "assigned_at"]


class GroupAdminWriteSerializer(serializers.Serializer):
    """Write serializer for assigning a group admin."""
    user_id = serializers.UUIDField()

    def validate_user_id(self, value):
        User = get_user_model()
        if not User.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("No active user with this ID.")
        return value
