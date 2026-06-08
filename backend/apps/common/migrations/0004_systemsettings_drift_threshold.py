from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0003_systemsettings_instructors_can_view_all"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="attendance_drift_threshold_minutes",
            field=models.PositiveIntegerField(default=30),
        ),
    ]
