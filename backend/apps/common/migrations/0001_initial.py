from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies: list = []

    operations = [
        migrations.CreateModel(
            name="SchedulerHealth",
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
                ("last_heartbeat_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "common_scheduler_health",
            },
        ),
    ]
