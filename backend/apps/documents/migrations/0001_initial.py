from __future__ import annotations

import django.db.models.deletion
import uuid
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
            name="Document",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("file_url", models.CharField(max_length=1000)),
                ("file_name", models.CharField(max_length=255)),
                ("file_type", models.CharField(max_length=100)),
                ("file_size", models.PositiveBigIntegerField()),
                ("doc_type", models.CharField(
                    choices=[
                        ("SLIDES", "Slides"),
                        ("TEMPLATE", "Template"),
                        ("QUIZ", "Quiz"),
                        ("REPORT", "Report"),
                        ("GUIDE", "Guide"),
                        ("REFERENCE", "Reference"),
                        ("SCHEDULE", "Schedule"),
                        ("CASE_STUDY", "Case Study"),
                    ],
                    default="GUIDE",
                    max_length=20,
                )),
                ("visibility", models.CharField(
                    choices=[
                        ("GROUP", "Group"),
                        ("SELECTED", "Selected Users"),
                        ("STAFF_ONLY", "Staff Only"),
                        ("PUBLIC_TO_CLASS", "Public to Class"),
                    ],
                    default="GROUP",
                    max_length=20,
                )),
                ("allowed_user_ids", models.JSONField(default=list)),
                ("class_obj", models.ForeignKey(
                    blank=True,
                    db_column="class_id",
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="documents",
                    to="scheduling.class",
                )),
                ("group", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="documents",
                    to="groups.classgroup",
                )),
                ("uploaded_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="uploaded_documents",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ParticipantUploadPermission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("group", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="upload_permissions",
                    to="groups.classgroup",
                )),
                ("granted_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="granted_upload_permissions",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="upload_permissions",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"unique_together": {("user", "group")}},
        ),
        migrations.CreateModel(
            name="ParticipantSharedDoc",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("file_url", models.CharField(max_length=1000)),
                ("file_name", models.CharField(max_length=255)),
                ("file_type", models.CharField(max_length=100)),
                ("file_size", models.PositiveBigIntegerField()),
                ("suggested_visibility", models.CharField(
                    choices=[
                        ("GROUP", "Group"),
                        ("SELECTED", "Selected Users"),
                        ("STAFF_ONLY", "Staff Only"),
                        ("PUBLIC_TO_CLASS", "Public to Class"),
                    ],
                    default="GROUP",
                    max_length=20,
                )),
                ("suggested_user_ids", models.JSONField(default=list)),
                ("status", models.CharField(
                    choices=[
                        ("PENDING", "Pending"),
                        ("APPROVED", "Approved"),
                        ("REJECTED", "Rejected"),
                    ],
                    default="PENDING",
                    max_length=10,
                )),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("rejection_reason", models.TextField(blank=True, default="")),
                ("group", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="shared_docs",
                    to="groups.classgroup",
                )),
                ("resulting_document", models.OneToOneField(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="source_shared_doc",
                    to="documents.document",
                )),
                ("reviewed_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="reviewed_shared_docs",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("uploaded_by", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="shared_docs",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="document",
            index=models.Index(fields=["group", "visibility"], name="doc_group_vis_idx"),
        ),
        migrations.AddIndex(
            model_name="document",
            index=models.Index(fields=["class_obj"], name="doc_class_idx"),
        ),
        migrations.AddIndex(
            model_name="participantuploadpermission",
            index=models.Index(fields=["user", "group"], name="upload_perm_user_group_idx"),
        ),
        migrations.AddIndex(
            model_name="participantshareddoc",
            index=models.Index(fields=["status", "created_at"], name="shared_doc_status_idx"),
        ),
        migrations.AddIndex(
            model_name="participantshareddoc",
            index=models.Index(fields=["group", "status"], name="shared_doc_group_status_idx"),
        ),
    ]
