from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel


class Document(TimestampedModel):
    # doc_type: aligned to frontend seed values (F-08 D6 / F-10 D2)
    SLIDES = "SLIDES"
    TEMPLATE = "TEMPLATE"
    QUIZ = "QUIZ"
    REPORT = "REPORT"
    GUIDE = "GUIDE"
    REFERENCE = "REFERENCE"
    SCHEDULE = "SCHEDULE"
    CASE_STUDY = "CASE_STUDY"

    DOC_TYPE_CHOICES = [
        (SLIDES, "Slides"),
        (TEMPLATE, "Template"),
        (QUIZ, "Quiz"),
        (REPORT, "Report"),
        (GUIDE, "Guide"),
        (REFERENCE, "Reference"),
        (SCHEDULE, "Schedule"),
        (CASE_STUDY, "Case Study"),
    ]

    VIS_GROUP = "GROUP"
    VIS_SELECTED = "SELECTED"
    VIS_STAFF_ONLY = "STAFF_ONLY"
    VIS_PUBLIC_TO_CLASS = "PUBLIC_TO_CLASS"

    VISIBILITY_CHOICES = [
        (VIS_GROUP, "Group"),
        (VIS_SELECTED, "Selected Users"),
        (VIS_STAFF_ONLY, "Staff Only"),
        (VIS_PUBLIC_TO_CLASS, "Public to Class"),
    ]

    group = models.ForeignKey(
        "groups.ClassGroup",
        on_delete=models.CASCADE,
        related_name="documents",
    )
    class_obj = models.ForeignKey(
        "scheduling.Class",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
        db_column="class_id",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField()
    doc_type = models.CharField(max_length=100, default=GUIDE)
    visibility = models.CharField(
        max_length=20, choices=VISIBILITY_CHOICES, default=VIS_GROUP
    )
    # list[str] of user UUIDs; always coerce to list before save
    allowed_user_ids = models.JSONField(default=list)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_documents",
    )

    class Meta:
        indexes = [
            models.Index(fields=["group", "visibility"], name="doc_group_vis_idx"),
            models.Index(fields=["class_obj"], name="doc_class_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs) -> None:
        if not isinstance(self.allowed_user_ids, list):
            self.allowed_user_ids = list(self.allowed_user_ids)
        super().save(*args, **kwargs)


class ParticipantUploadPermission(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="upload_permissions",
    )
    group = models.ForeignKey(
        "groups.ClassGroup",
        on_delete=models.CASCADE,
        related_name="upload_permissions",
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="granted_upload_permissions",
    )

    class Meta:
        unique_together = [("user", "group")]
        indexes = [
            models.Index(fields=["user", "group"], name="upload_perm_user_group_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} → {self.group_id}"


class ParticipantSharedDoc(TimestampedModel):
    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    group = models.ForeignKey(
        "groups.ClassGroup",
        on_delete=models.CASCADE,
        related_name="shared_docs",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shared_docs",
    )
    title = models.CharField(max_length=255)
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField()
    suggested_visibility = models.CharField(
        max_length=20,
        choices=Document.VISIBILITY_CHOICES,
        default=Document.VIS_GROUP,
    )
    suggested_user_ids = models.JSONField(default=list)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_shared_docs",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")
    resulting_document = models.OneToOneField(
        Document,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="source_shared_doc",
    )

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"], name="shared_doc_status_idx"),
            models.Index(fields=["group", "status"], name="shared_doc_group_status_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"
