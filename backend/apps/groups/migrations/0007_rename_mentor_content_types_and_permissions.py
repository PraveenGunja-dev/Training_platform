from django.db import migrations


RENAMES = (
    ("groupinstructor", "groupsubmentor", "Group Instructor", "Group Sub-Mentor"),
    ("groupadmin", "groupleadmentor", "Group Admin", "Group Lead Mentor"),
)


def rename_metadata(apps, *, forward):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")

    for old_model, new_model, old_label, new_label in RENAMES:
        source_model, target_model = (
            (old_model, new_model) if forward else (new_model, old_model)
        )
        source_label, target_label = (
            (old_label, new_label) if forward else (new_label, old_label)
        )
        source = ContentType.objects.filter(
            app_label="groups", model=source_model
        ).first()
        target = ContentType.objects.filter(
            app_label="groups", model=target_model
        ).first()

        if source is None:
            continue
        if target is not None:
            raise RuntimeError(
                "Cannot rename groups content type metadata while both "
                f"{source_model!r} and {target_model!r} exist."
            )

        source.model = target_model
        source.save(update_fields=["model"])
        suffix = f"_{source_model}"
        for permission in Permission.objects.filter(content_type_id=source.pk).iterator():
            if permission.codename.endswith(suffix):
                permission.codename = f"{permission.codename[:-len(source_model)]}{target_model}"
            for old_name, new_name in (
                (source_label.lower(), target_label.lower()),
                (source_label, target_label),
                (source_model.replace("group", "group "), target_model.replace("group", "group ")),
                (source_model, target_model),
            ):
                permission.name = permission.name.replace(old_name, new_name)
            permission.save(update_fields=["codename", "name"])


def forwards(apps, schema_editor):
    rename_metadata(apps, forward=True)


def backwards(apps, schema_editor):
    rename_metadata(apps, forward=False)


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("groups", "0006_rename_mentor_relationships"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]