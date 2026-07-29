from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("common", "0004_systemsettings_drift_threshold")]
    operations = [migrations.RenameField(model_name="systemsettings", old_name="instructors_can_view_all_classes", new_name="sub_mentors_can_view_all_classes")]