import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('assignments', '0003_add_submission_review'),
        ('groups', '0003_subgroup_subgroupmembership'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignmenttask',
            name='sub_group',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assignment_tasks',
                to='groups.subgroup',
            ),
        ),
    ]
