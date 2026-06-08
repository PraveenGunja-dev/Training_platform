from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.groups.models import ClassGroup
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

    class Meta:
        model = AssignmentTask
        fields = [
            "id",
            "group_id",
            "group_name",
            "class_id",
            "class_title",
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
    question_file_url = serializers.CharField(max_length=1000, required=False, default="", allow_blank=True)
    question_file_name = serializers.CharField(max_length=255, required=False, default="", allow_blank=True)
    question_file_type = serializers.CharField(max_length=100, required=False, default="", allow_blank=True)
    question_file_size = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate(self, attrs: dict) -> dict:
        upload_open = attrs.get("upload_open_at")
        deadline = attrs.get("deadline_at")
        if upload_open and deadline and upload_open >= deadline:
            raise serializers.ValidationError(
                {"deadline_at": "deadline_at must be after upload_open_at."}
            )
        return attrs


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
        return attrs


class SubmissionSerializer(serializers.ModelSerializer):
    task_id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)
    user = SubmissionUserSerializer(read_only=True)
    submitted_by = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

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


# ---------------------------------------------------------------------------
# Submission — write (submit)
# ---------------------------------------------------------------------------


class SubmissionWriteSerializer(serializers.Serializer):
    file_url = serializers.CharField(max_length=1000)
    file_name = serializers.CharField(max_length=255)
    file_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, default="", allow_blank=True)
    user_id = serializers.UUIDField(required=False, allow_null=True)


# ---------------------------------------------------------------------------
# Upload-URL — write
# ---------------------------------------------------------------------------


class UploadUrlSerializer(serializers.Serializer):
    file_name = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100)
