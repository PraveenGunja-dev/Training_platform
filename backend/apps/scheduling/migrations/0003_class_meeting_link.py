from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0002_class_attendance_window"),
    ]

    operations = [
        migrations.AddField(
            model_name="class",
            name="meeting_link",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
    ]
