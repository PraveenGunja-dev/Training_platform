from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class AttendanceSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_obj = models.ForeignKey(
        "scheduling.Class",
        on_delete=models.CASCADE,
        db_column="class_id",
        related_name="attendance_sessions",
    )
    started_at = models.DateTimeField()
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="started_sessions",
    )
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ended_sessions",
    )
    STATUS_CHOICES = [("ACTIVE", "Active"), ("ENDED", "Ended")]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="ACTIVE")
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    scheduled_end_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["class_obj"],
                condition=models.Q(status="ACTIVE"),
                name="uniq_active_session_per_class",
            ),
        ]
        indexes = [
            models.Index(fields=["class_obj", "status"], name="att_sess_class_status_idx"),
            models.Index(fields=["started_at"], name="att_sess_started_at_idx"),
        ]

    def __str__(self) -> str:
        return f"Session {self.id} [{self.status}]"


class AttendanceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name="records",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    marked_at = models.DateTimeField()
    STATUS_PRESENT = "PRESENT"
    STATUS_ABSENT = "ABSENT"
    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("ABSENT", "Absent"),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PRESENT")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "user"], name="uniq_record_session_user"),
        ]
        indexes = [
            models.Index(fields=["session", "user"], name="att_rec_session_user_idx"),
        ]

    def __str__(self) -> str:
        return f"Record {self.id} — {self.status}"
