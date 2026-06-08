from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel


class AssignmentTask(TimestampedModel):
    LATE_STRICT = "STRICT"
    LATE_ALLOWED = "LATE_ALLOWED"
    LATE_ADMIN_ONLY = "ADMIN_ONLY"

    LATE_POLICY_CHOICES = [
        (LATE_STRICT, "Strict"),
        (LATE_ALLOWED, "Late Allowed"),
        (LATE_ADMIN_ONLY, "Admin Only"),
    ]

    group = models.ForeignKey(
        "groups.ClassGroup",
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    class_obj = models.ForeignKey(
        "scheduling.Class",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks",
        db_column="class_id",
    )
    title = models.CharField(max_length=255)
    question = models.TextField()
    description = models.TextField(blank=True, default="")
    instructions = models.TextField(blank=True, default="")
    upload_open_at = models.DateTimeField()
    deadline_at = models.DateTimeField()
    late_policy = models.CharField(
        max_length=20,
        choices=LATE_POLICY_CHOICES,
        default=LATE_STRICT,
    )
    reminder_offsets = models.JSONField(default=list)
    question_file_url = models.CharField(max_length=1000, blank=True, default="")
    question_file_name = models.CharField(max_length=255, blank=True, default="")
    question_file_type = models.CharField(max_length=100, blank=True, default="")
    question_file_size = models.PositiveBigIntegerField(null=True, blank=True)
    is_open = models.BooleanField(default=False)
    is_closed = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_tasks",
    )

    class Meta:
        indexes = [
            models.Index(fields=["group", "deadline_at"], name="task_group_deadline_idx"),
            models.Index(fields=["deadline_at"], name="task_deadline_idx"),
            models.Index(fields=["is_open", "deadline_at"], name="task_open_deadline_idx"),
        ]
        ordering = ["deadline_at"]

    def __str__(self) -> str:
        return self.title


class Submission(TimestampedModel):
    STATUS_SUBMITTED = "SUBMITTED"
    STATUS_LATE = "LATE_SUBMITTED"
    STATUS_OVERRIDE = "OVERRIDE_BY_ADMIN"

    STATUS_CHOICES = [
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_LATE, "Late Submitted"),
        (STATUS_OVERRIDE, "Override by Admin"),
    ]

    task = models.ForeignKey(
        AssignmentTask,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    version = models.PositiveIntegerField(default=1)
    file_url = models.CharField(max_length=1000)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_SUBMITTED,
    )
    submitted_at = models.DateTimeField()
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submissions_on_behalf",
    )
    note = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("task", "user", "version")]
        indexes = [
            models.Index(fields=["task", "user"], name="submission_task_user_idx"),
            models.Index(fields=["submitted_at"], name="submission_submitted_at_idx"),
        ]
        ordering = ["-submitted_at"]

    def __str__(self) -> str:
        return f"{self.task.title} — v{self.version} by {self.user_id}"


class SubmissionReview(models.Model):
    LETTER_GRADE_CHOICES = [
        ("A+", "A+"), ("A", "A"), ("A-", "A-"),
        ("B+", "B+"), ("B", "B"), ("B-", "B-"),
        ("C+", "C+"), ("C", "C"), ("C-", "C-"),
        ("D", "D"), ("F", "F"),
    ]

    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="review",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="submission_reviews",
    )
    comment = models.TextField(blank=True, default="")
    grade_numeric = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    grade_letter = models.CharField(
        max_length=2, choices=LETTER_GRADE_CHOICES, blank=True, default=""
    )
    reviewed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assignments_submissionreview"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.grade_numeric is not None and self.grade_letter:
            raise ValidationError(
                "A review cannot have both a numeric grade and a letter grade."
            )

    def __str__(self):
        return f"Review for submission {self.submission_id}"
