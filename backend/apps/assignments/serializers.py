from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.groups.models import ClassGroup, SubGroup
from apps.scheduling.models import Class

from .models import AssignmentTask, Submission, SubmissionReview

User = get_user_model()


# ---------------------------------------------------------------------------
# AssignmentTask — read
# ---------------------------------------------------------------------------


class AssignmentTaskSerializer(serializers.ModelSerializer):
    group_id = serializers.UUIDField(read_only=True)
    group_name = serializers.SerializerMethodField()
    class_id = serializers.SerializerMethodField()
    class_title = serializers.SerializerMethodField()
    question_file_url = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentTask
        fields = [
            "id",
            "group_id",
            "group_name",
            "class_id",
            "class_title",
            "sub_group_id",
            "title",
            "question",
            "description",
            "instructions",
            "upload_open_at",
            "deadline_at",
            "late_policy",
            "reminder_offsets",
            "is_open",
            "is_closed",
            "question_file_url",
            "question_file_name",
            "question_file_type",
            "question_file_size",
            "created_at",
        ]

    def get_group_name(self, obj: AssignmentTask) -> str:
        return obj.group.name if obj.group_id else ""

    def get_class_id(self, obj: AssignmentTask) -> str | None:
        return str(obj.class_obj_id) if obj.class_obj_id else None

    def get_class_title(self, obj: AssignmentTask) -> str | None:
        return obj.class_obj.title if obj.class_obj_id and obj.class_obj else None

    def get_question_file_url(self, obj: AssignmentTask) -> str:
        if obj.question_file_data:
            return f"/api/v1/assignments/{obj.id}/question-file"
        return ""


# ---------------------------------------------------------------------------
# AssignmentTask — write (create / partial-update)
# ---------------------------------------------------------------------------


class AssignmentTaskWriteSerializer(serializers.Serializer):
    group_id = serializers.PrimaryKeyRelatedField(
        source="group",
        queryset=ClassGroup.objects.all(),
    )
    class_id = serializers.PrimaryKeyRelatedField(
        source="class_obj",
        queryset=Class.objects.all(),
        required=False,
        allow_null=True,
    )
    sub_group_id = serializers.PrimaryKeyRelatedField(
        source='sub_group',
        queryset=SubGroup.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )
    title = serializers.CharField(max_length=255)
    question = serializers.CharField()
    description = serializers.CharField(required=False, default="")
    instructions = serializers.CharField(required=False, default="")
    upload_open_at = serializers.DateTimeField()
    deadline_at = serializers.DateTimeField()
    late_policy = serializers.ChoiceField(
        choices=AssignmentTask.LATE_POLICY_CHOICES,
        default=AssignmentTask.LATE_STRICT,
        required=False,
    )
    reminder_offsets = serializers.ListField(
        child=serializers.IntegerField(min_value=0),
        required=False,
        default=list,
    )
    is_open = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs: dict) -> dict:
        from django.utils import timezone as _tz
        upload_open = attrs.get("upload_open_at")
        deadline = attrs.get("deadline_at")
        if upload_open and deadline and upload_open >= deadline:
            raise serializers.ValidationError(
                {"deadline_at": "deadline_at must be after upload_open_at."}
            )
        if deadline and not self.partial:
            if deadline <= _tz.now():
                raise serializers.ValidationError(
                    {"deadline_at": "Deadline must be a future date and time."}
                )
        sub_group = attrs.get('sub_group')
        group = attrs.get('group') or (self.instance.group if self.instance else None)
        if sub_group is not None and group is not None:
            if str(sub_group.parent_group_id) != str(group.id):
                raise serializers.ValidationError(
                    {'sub_group_id': 'Sub-group does not belong to the selected group.'}
                )
        return attrs

    def create(self, validated_data):
        import logging  # noqa: PLC0415
        _log = logging.getLogger(__name__)
        if not validated_data.get('reminder_offsets'):
            try:
                from apps.common.models import SystemSettings  # noqa: PLC0415
                validated_data.setdefault('reminder_offsets', SystemSettings.get_solo().reminder_offsets or [])
            except Exception:
                _log.warning("Could not fetch SystemSettings for reminder_offsets default; using []", exc_info=True)
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Submission — read
# ---------------------------------------------------------------------------


class SubmissionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "email", "photo_url")


class SubmissionReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionReview
        fields = [
            "id", "submission_id", "reviewer_id", "reviewer_name",
            "comment", "grade_numeric", "grade_letter",
            "reviewed_at", "updated_at",
        ]
        read_only_fields = [
            "id", "submission_id", "reviewer_id", "reviewer_name",
            "reviewed_at", "updated_at",
        ]

    def get_reviewer_name(self, obj: SubmissionReview) -> str | None:
        return obj.reviewer.full_name if obj.reviewer else None

    def validate(self, attrs: dict) -> dict:
        grade_numeric = attrs.get("grade_numeric")
        grade_letter = attrs.get("grade_letter", "")
        if grade_numeric is not None and grade_letter:
            raise serializers.ValidationError(
                {"grade": "Cannot set both numeric and letter grade."}
            )
        if grade_numeric is not None and not (0 <= float(grade_numeric) <= 100):
            raise serializers.ValidationError(
                {"grade_numeric": "Numeric grade must be between 0 and 100."}
            )
        return attrs


class SubmissionSerializer(serializers.ModelSerializer):
    task_id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)
    user = SubmissionUserSerializer(read_only=True)
    submitted_by = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "task_id",
            "user_id",
            "user",
            "version",
            "file_url",
            "file_name",
            "file_type",
            "file_size",
            "status",
            "submitted_at",
            "submitted_by",
            "note",
            "review",
        ]

    def get_submitted_by(self, obj: Submission) -> str | None:
        return str(obj.submitted_by_id) if obj.submitted_by_id else None

    def get_review(self, obj: Submission):
        try:
            return SubmissionReviewSerializer(obj.review).data
        except SubmissionReview.DoesNotExist:
            return None

    def get_file_url(self, obj: Submission) -> str:
        return f"/api/v1/submissions/{obj.id}/file"
