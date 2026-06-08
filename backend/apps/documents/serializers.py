from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.groups.models import ClassGroup
from apps.scheduling.models import Class

from .models import Document, ParticipantSharedDoc, ParticipantUploadPermission

User = get_user_model()


# ---------------------------------------------------------------------------
# Document — read
# ---------------------------------------------------------------------------


class DocumentSerializer(serializers.ModelSerializer):
    group_id = serializers.UUIDField(read_only=True)
    class_id = serializers.SerializerMethodField()
    uploaded_by_id = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "group_id",
            "class_id",
            "title",
            "description",
            "file_url",
            "file_name",
            "file_type",
            "file_size",
            "doc_type",
            "visibility",
            "allowed_user_ids",
            "uploaded_by_id",
            "created_at",
            "updated_at",
        ]

    def get_class_id(self, obj: Document) -> str | None:
        return str(obj.class_obj_id) if obj.class_obj_id else None

    def get_uploaded_by_id(self, obj: Document) -> str | None:
        return str(obj.uploaded_by_id) if obj.uploaded_by_id else None


# ---------------------------------------------------------------------------
# Document — write (Admin create / partial-update)
# ---------------------------------------------------------------------------


class DocumentWriteSerializer(serializers.Serializer):
    group_id = serializers.PrimaryKeyRelatedField(
        source="group", queryset=ClassGroup.objects.all()
    )
    class_id = serializers.PrimaryKeyRelatedField(
        source="class_obj",
        queryset=Class.objects.all(),
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="", allow_blank=True)
    file_url = serializers.CharField(max_length=1000)
    file_name = serializers.CharField(max_length=255)
    file_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField(min_value=1)
    doc_type = serializers.ChoiceField(choices=Document.DOC_TYPE_CHOICES, default=Document.GUIDE)
    visibility = serializers.ChoiceField(
        choices=Document.VISIBILITY_CHOICES, default=Document.VIS_GROUP
    )
    allowed_user_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


# ---------------------------------------------------------------------------
# ParticipantUploadPermission — read
# ---------------------------------------------------------------------------


class UploadPermissionSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)
    group_id = serializers.UUIDField(read_only=True)
    granted_by_id = serializers.SerializerMethodField()

    class Meta:
        model = ParticipantUploadPermission
        fields = ["id", "user_id", "group_id", "granted_by_id", "created_at"]

    def get_granted_by_id(self, obj: ParticipantUploadPermission) -> str | None:
        return str(obj.granted_by_id) if obj.granted_by_id else None


# ---------------------------------------------------------------------------
# ParticipantSharedDoc — read
# ---------------------------------------------------------------------------


class SharedDocUploaderSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "email", "photo_url")


class SharedDocSerializer(serializers.ModelSerializer):
    group_id = serializers.UUIDField(read_only=True)
    uploaded_by_id = serializers.SerializerMethodField()
    uploaded_by = SharedDocUploaderSerializer(read_only=True)
    reviewed_by_id = serializers.SerializerMethodField()
    resulting_document_id = serializers.SerializerMethodField()

    class Meta:
        model = ParticipantSharedDoc
        fields = [
            "id",
            "group_id",
            "uploaded_by_id",
            "uploaded_by",
            "title",
            "file_url",
            "file_name",
            "file_type",
            "file_size",
            "suggested_visibility",
            "suggested_user_ids",
            "status",
            "reviewed_by_id",
            "reviewed_at",
            "rejection_reason",
            "resulting_document_id",
            "created_at",
        ]

    def get_uploaded_by_id(self, obj: ParticipantSharedDoc) -> str:
        return str(obj.uploaded_by_id)

    def get_reviewed_by_id(self, obj: ParticipantSharedDoc) -> str | None:
        return str(obj.reviewed_by_id) if obj.reviewed_by_id else None

    def get_resulting_document_id(self, obj: ParticipantSharedDoc) -> str | None:
        return str(obj.resulting_document_id) if obj.resulting_document_id else None


# ---------------------------------------------------------------------------
# ParticipantSharedDoc — write (Participant upload)
# ---------------------------------------------------------------------------


class SharedDocWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    file_url = serializers.CharField(max_length=1000)
    file_name = serializers.CharField(max_length=255)
    file_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField(min_value=1)
    suggested_visibility = serializers.ChoiceField(
        choices=Document.VISIBILITY_CHOICES, default=Document.VIS_GROUP
    )
    suggested_user_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


# ---------------------------------------------------------------------------
# Approve shared doc — write
# ---------------------------------------------------------------------------


class ApproveSharedDocSerializer(serializers.Serializer):
    visibility = serializers.ChoiceField(choices=Document.VISIBILITY_CHOICES)
    allowed_user_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


# ---------------------------------------------------------------------------
# Reject shared doc — write
# ---------------------------------------------------------------------------


class RejectSharedDocSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=1)
