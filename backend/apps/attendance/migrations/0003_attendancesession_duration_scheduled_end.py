from __future__ import annotations
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("attendance", "0002_add_absent_status_choice"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancesession",
            name="duration_minutes",
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="attendancesession",
            name="scheduled_end_at",
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
