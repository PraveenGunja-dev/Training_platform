from __future__ import annotations

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("groups", "0001_initial"),
        ("scheduling", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AssignmentTask",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("question", models.TextField()),
                ("description", models.TextField(blank=True, default="")),
                ("instructions", models.TextField(blank=True, default="")),
                ("upload_open_at", models.DateTimeField()),
                ("deadline_at", models.DateTimeField()),
                (
                    "late_policy",
                    models.CharField(
                        choices=[
                            ("STRICT", "Strict"),
                            ("LATE_ALLOWED", "Late Allowed"),
                            ("ADMIN_ONLY", "Admin Only"),
                        ],
                        default="STRICT",
                        max_length=20,
                    ),
                ),
                ("reminder_offsets", models.JSONField(default=list)),
                ("is_open", models.BooleanField(default=False)),
                ("is_closed", models.BooleanField(default=False)),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tasks",
                        to="groups.classgroup",
                    ),
                ),
                (
                    "class_obj",
                    models.ForeignKey(
                        blank=True,
                        db_column="class_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tasks",
                        to="scheduling.class",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_tasks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["deadline_at"],
            },
        ),
        migrations.CreateModel(
            name="Submission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("file_url", models.CharField(max_length=1000)),
                ("file_name", models.CharField(max_length=255)),
                ("file_type", models.CharField(max_length=100)),
                ("file_size", models.PositiveBigIntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("SUBMITTED", "Submitted"),
                            ("LATE_SUBMITTED", "Late Submitted"),
                            ("OVERRIDE_BY_ADMIN", "Override by Admin"),
                        ],
                        default="SUBMITTED",
                        max_length=20,
                    ),
                ),
                ("submitted_at", models.DateTimeField()),
                ("note", models.TextField(blank=True, default="")),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="submissions",
                        to="assignments.assignmenttask",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="submissions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "submitted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="submissions_on_behalf",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-submitted_at"],
            },
        ),
        migrations.AddIndex(
            model_name="assignmenttask",
            index=models.Index(fields=["group", "deadline_at"], name="task_group_deadline_idx"),
        ),
        migrations.AddIndex(
            model_name="assignmenttask",
            index=models.Index(fields=["deadline_at"], name="task_deadline_idx"),
        ),
        migrations.AddIndex(
            model_name="assignmenttask",
            index=models.Index(fields=["is_open", "deadline_at"], name="task_open_deadline_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="submission",
            unique_together={("task", "user", "version")},
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["task", "user"], name="submission_task_user_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["submitted_at"], name="submission_submitted_at_idx"),
        ),
    ]
