import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('scheduling', '0003_class_meeting_link'),
        ('groups', '0003_subgroup_subgroupmembership'),
    ]

    operations = [
        migrations.AddField(
            model_name='class',
            name='sub_group',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='classes',
                to='groups.subgroup',
            ),
        ),
    ]
