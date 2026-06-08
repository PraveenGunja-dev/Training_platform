from __future__ import annotations
import uuid
from django.conf import settings
from django.db import models


class Notification(models.Model):
    TYPE_CHOICES = [
        ("DEADLINE_REMINDER", "Deadline Reminder"),
        ("TASK_OPENED", "Task Opened"),
        ("SHARED_DOC_RESULT", "Shared Doc Result"),
        ("CLASS_SCHEDULED", "Class Scheduled"),
        ("CLASS_STARTING_SOON", "Class Starting Soon"),
        ("CLASS_RESCHEDULED", "Class Rescheduled"),
        ("CLASS_DOCUMENT_ADDED", "Class Document Added"),
        ("CLASS_TASK_ASSIGNED", "Task Assigned to Class"),
        ("ATTENDANCE_SESSION_STARTED", "Attendance Session Started"),
        ("ATTENDANCE_SESSION_ENDED", "Attendance Session Ended"),
        ("ATTENDANCE_CLOSING_SOON", "Attendance Closing Soon"),
        ("ATTENDANCE_OVERRIDE", "Attendance Override"),
        ("GROUP_ADDED", "Added to Group"),
        ("INVITE_RESENT", "Invite Resent"),
        # Instructor notification types
        ("GROUP_ASSIGNED", "Group Assigned"),
        ("GROUP_UNASSIGNED", "Group Unassigned"),
        ("CO_INSTRUCTOR_ADDED", "Co-Instructor Added"),
        ("CLASS_SCHEDULED_BY_ADMIN", "Class Scheduled by Admin"),
        ("CLASS_CANCELLED", "Class Cancelled"),
        ("CO_INSTRUCTOR_EDITED_CLASS", "Co-Instructor Edited Class"),
        ("ASSIGNMENT_CREATED_IN_GROUP", "Assignment Created in Group"),
        ("SUBMISSION_RECEIVED", "Submission Received"),
        ("DEADLINE_APPROACHING", "Deadline Approaching"),
        ("ATTENDANCE_SESSION_REMINDER", "Attendance Session Reminder"),
        ("PARTICIPANTS_ADDED_TO_GROUP", "Participants Added to Group"),
        ("PARTICIPANTS_REMOVED_FROM_GROUP", "Participants Removed from Group"),
        ("SHARED_UPLOAD_PENDING", "Shared Upload Pending"),
        ("SUBMISSION_REVIEWED", "Submission Reviewed"),
        ("LATE_ATTENDANCE_QR_SHARED", "Late Attendance QR Shared"),
    ]
    CHANNEL_CHOICES = [("IN_APP", "In-App")]
    STATUS_CHOICES = [("SENT", "Sent")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default="IN_APP")
    title = models.CharField(max_length=200)
    body = models.TextField()
    link = models.CharField(max_length=500, blank=True, default="")
    dedupe_key = models.CharField(max_length=200, unique=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="SENT")
    read_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField()
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "read_at"], name="notif_user_read_idx"),
            models.Index(fields=["user", "created_at"], name="notif_user_created_idx"),
            models.Index(fields=["dedupe_key"], name="notif_dedupe_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.type} → {self.user_id}"


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_prefs",
    )
    in_app_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    digest_submissions = models.BooleanField(default=False)

    class Meta:
        db_table = "notifications_preference"

    def __str__(self) -> str:
        return f"NotificationPreference({self.user_id})"
