from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("ADMIN", "Admin"),
                    ("INSTRUCTOR", "Instructor"),
                    ("PARTICIPANT", "Participant"),
                ],
                default="PARTICIPANT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="can_view_all_classes",
            field=models.BooleanField(blank=True, default=None, null=True),
        ),
    ]
