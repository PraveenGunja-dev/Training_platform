import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0009_rename_roles_to_mentors"), ("groups", "0005_add_subgroupmembership_user_index")]
    operations = [
        migrations.RenameModel("GroupInstructor", "GroupSubMentor"),
        migrations.RemoveIndex("groupsubmentor", "grp_ins_lookup_idx"),
        migrations.RenameField("groupsubmentor", "instructor", "sub_mentor"),
        migrations.AddIndex("groupsubmentor", models.Index(fields=["sub_mentor", "group"], name="grp_sub_mentor_lookup_idx")),
        migrations.AlterField("groupsubmentor", "sub_mentor", models.ForeignKey(limit_choices_to={"role": "SUB_MENTOR"}, on_delete=django.db.models.deletion.CASCADE, related_name="sub_mentored_groups", to=settings.AUTH_USER_MODEL)),
        migrations.AlterField("groupsubmentor", "assigned_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sub_mentor_assignments_made", to=settings.AUTH_USER_MODEL)),
        migrations.AlterField("groupsubmentor", "group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sub_mentors", to="groups.classgroup")),
        migrations.RenameModel("GroupAdmin", "GroupLeadMentor"),
        migrations.RenameField("groupleadmentor", "admin", "lead_mentor"),
        migrations.AlterField("groupleadmentor", "group", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="lead_mentor_assignment", to="groups.classgroup")),
        migrations.AlterField("groupleadmentor", "lead_mentor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lead_mentor_of_groups", to=settings.AUTH_USER_MODEL)),
        migrations.AlterField("groupleadmentor", "assigned_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lead_mentors_assigned", to=settings.AUTH_USER_MODEL)),
        migrations.AlterModelOptions(name="groupleadmentor", options={"verbose_name": "Group Lead Mentor", "verbose_name_plural": "Group Lead Mentors"}),
    ]