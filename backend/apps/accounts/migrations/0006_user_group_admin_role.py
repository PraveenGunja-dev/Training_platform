from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_user_employee_code"),
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
                    ("GROUP_ADMIN", "Group Admin"),
                ],
                default="PARTICIPANT",
                max_length=20,
            ),
        ),
    ]
