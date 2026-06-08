from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0002_system_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="instructors_can_view_all_classes",
            field=models.BooleanField(default=False),
        ),
    ]
