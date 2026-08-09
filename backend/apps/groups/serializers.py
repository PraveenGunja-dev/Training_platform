from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ClassGroup, GroupLeadMentor, GroupSubMentor, SubGroup, SubGroupMembership

User = get_user_model()


class ClassGroupListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()

    sub_mentors = serializers.SerializerMethodField()

    class Meta:
        model = ClassGroup
        fields = [
            "id",
            "name",
            "description",
            "location",
            "is_archived",
            "created_by",
            "created_by_name",
            "participants_count",
            "sub_mentors",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]

    def get_created_by_name(self, obj: ClassGroup) -> str | None:
        return obj.created_by.full_name if obj.created_by else None

    def get_participants_count(self, obj: ClassGroup) -> int:
        return obj.memberships.count()

    def get_sub_mentors(self, obj: ClassGroup) -> list:
        return [
            {
                "id": str(gi.sub_mentor.id),
                "full_name": gi.sub_mentor.full_name,
                "email": gi.sub_mentor.email,
                "employee_code": gi.sub_mentor.employee_code or "",
                "business_unit": gi.sub_mentor.business_unit or "",
            }
            for gi in obj.sub_mentors.select_related("sub_mentor").all()
        ]


class ClassGroupDetailSerializer(ClassGroupListSerializer):
    participants = serializers.SerializerMethodField()
    lead_mentor = serializers.SerializerMethodField()

    class Meta(ClassGroupListSerializer.Meta):
        fields = ClassGroupListSerializer.Meta.fields + ["participants", "lead_mentor"]

    def get_participants(self, obj: ClassGroup) -> list:
        from apps.attendance.models import AttendanceRecord, AttendanceSession  # noqa: PLC0415
        from apps.assignments.models import AssignmentTask, Submission  # noqa: PLC0415
        from django.db.models import Count  # noqa: PLC0415

        total_sessions = AttendanceSession.objects.filter(class_obj__group=obj).count()
        open_tasks = AssignmentTask.objects.filter(group=obj, is_open=True).count()

        attendance_map = dict(
            AttendanceRecord.objects.filter(
                session__class_obj__group=obj,
                status=AttendanceRecord.STATUS_PRESENT,
            )
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
        for m in obj.memberships.select_related("user").all():
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

    def get_lead_mentor(self, obj: ClassGroup):
        try:
            return GroupLeadMentorSerializer(obj.lead_mentor_assignment).data
        except GroupLeadMentor.DoesNotExist:
            return None


class ClassGroupWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassGroup
        fields = ["name", "description", "location", "is_archived"]
        extra_kwargs = {
            "description": {"required": False},
            "location": {"required": False},
            "is_archived": {"required": False},
        }


class BulkAddParticipantsSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)


class GroupSubMentorSerializer(serializers.ModelSerializer):
    """Read serializer — embeds minimal Sub-Mentor user data."""

    id = serializers.UUIDField(source="sub_mentor.id", read_only=True)
    full_name = serializers.CharField(source="sub_mentor.full_name", read_only=True)
    email = serializers.EmailField(source="sub_mentor.email", read_only=True)

    class Meta:
        model = GroupSubMentor
        fields = ["id", "full_name", "email", "assigned_at"]


class GroupSubMentorAssignSerializer(serializers.Serializer):
    """Write serializer — bulk assign Sub-Mentors to a group by user IDs."""

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
            blocked = found.filter(role__in=["ADMIN", "LEAD_MENTOR"])
            if blocked.exists():
                emails = list(blocked.values_list("email", flat=True))
                raise serializers.ValidationError(
                    {"user_ids": f"Cannot assign ADMIN or LEAD_MENTOR users as Sub-Mentors: {', '.join(emails)}."}
                )
        else:
            non_sub_mentors = found.exclude(role="SUB_MENTOR")
            if non_sub_mentors.exists():
                emails = list(non_sub_mentors.values_list("email", flat=True))
                raise serializers.ValidationError(
                    {"user_ids": f"The following users do not have the SUB_MENTOR role: {', '.join(emails)}."}
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
        return len(obj.memberships.all())


class SubGroupWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )

    def validate_name(self, value: str) -> str:
        return value.strip()


class GroupLeadMentorSerializer(serializers.ModelSerializer):
    """Read serializer — returns Lead Mentor user details. Null-safe for SET_NULL FK."""
    lead_mentor_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    assigned_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = GroupLeadMentor
        fields = ["lead_mentor_id", "full_name", "email", "assigned_at"]

    def get_lead_mentor_id(self, obj: GroupLeadMentor):
        return str(obj.lead_mentor_id) if obj.lead_mentor_id else None

    def get_full_name(self, obj: GroupLeadMentor):
        return obj.lead_mentor.full_name if obj.lead_mentor_id and obj.lead_mentor else None

    def get_email(self, obj: GroupLeadMentor):
        return obj.lead_mentor.email if obj.lead_mentor_id and obj.lead_mentor else None


class GroupLeadMentorWriteSerializer(serializers.Serializer):
    """Write serializer for assigning a Lead Mentor."""
    user_id = serializers.UUIDField()

    def validate_user_id(self, value):
        user = User.objects.filter(id=value, is_active=True).first()
        if not user:
            raise serializers.ValidationError("User not found or inactive.")
        if user.role not in ("LEAD_MENTOR", "ADMIN"):
            raise serializers.ValidationError(
                f"User '{user.full_name}' has role '{user.role}' and cannot be assigned as Lead Mentor. "
                "Only users with the LEAD_MENTOR or ADMIN role can be assigned."
            )
        return value
