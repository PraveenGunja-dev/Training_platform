from django.db import migrations, models


FORWARD = {"INSTRUCTOR": "SUB_MENTOR", "GROUP_ADMIN": "LEAD_MENTOR"}
REVERSE = {value: key for key, value in FORWARD.items()}


def rename_roles(apps, mapping, expected):
    User = apps.get_model("accounts", "User")
    unexpected = set(User.objects.exclude(role__in=expected).values_list("role", flat=True))
    if unexpected:
        raise RuntimeError(f"Unexpected accounts_user.role values: {sorted(unexpected)!r}")
    before = User.objects.count()
    for old, new in mapping.items():
        User.objects.filter(role=old).update(role=new)
    if User.objects.count() != before or User.objects.filter(role__in=mapping).exists():
        raise RuntimeError("Role rename failed to preserve every user.")


def forwards(apps, schema_editor):
    rename_roles(apps, FORWARD, {"ADMIN", "INSTRUCTOR", "PARTICIPANT", "GROUP_ADMIN"})


def backwards(apps, schema_editor):
    rename_roles(apps, REVERSE, {"ADMIN", "SUB_MENTOR", "PARTICIPANT", "LEAD_MENTOR"})


class Migration(migrations.Migration):
    dependencies = [("accounts", "0008_user_photo_binary")]
    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(model_name="user", name="role", field=models.CharField(choices=[("ADMIN", "Admin"), ("SUB_MENTOR", "Sub-Mentor"), ("PARTICIPANT", "Participant"), ("LEAD_MENTOR", "Lead Mentor")], default="PARTICIPANT", max_length=20)),
    ]