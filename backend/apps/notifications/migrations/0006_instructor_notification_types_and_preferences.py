from __future__ import annotations

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0005_alter_notification_type"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(
                choices=[
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
                ],
                max_length=40,
            ),
        ),
        migrations.CreateModel(
            name="NotificationPreference",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("in_app_enabled", models.BooleanField(default=True)),
                ("email_enabled", models.BooleanField(default=True)),
                ("digest_submissions", models.BooleanField(default=False)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notification_prefs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "notifications_preference"},
        ),
    ]
