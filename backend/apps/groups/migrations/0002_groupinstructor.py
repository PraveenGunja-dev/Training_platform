import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GroupInstructor",
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
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="instructors",
                        to="groups.classgroup",
                    ),
                ),
                (
                    "instructor",
                    models.ForeignKey(
                        limit_choices_to={"role": "INSTRUCTOR"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="instructed_groups",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "assigned_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="instructor_assignments_made",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("group", "instructor")},
            },
        ),
        migrations.AddIndex(
            model_name="groupinstructor",
            index=models.Index(
                fields=["instructor", "group"], name="grp_ins_lookup_idx"
            ),
        ),
    ]
