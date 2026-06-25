from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('assignments', '0004_assignmenttask_sub_group'),
    ]

    operations = [
        migrations.RemoveField(model_name='assignmenttask', name='question_file_url'),
        migrations.AddField(
            model_name='assignmenttask',
            name='question_file_data',
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.RemoveField(model_name='submission', name='file_url'),
        migrations.AddField(
            model_name='submission',
            name='file_data',
            field=models.BinaryField(blank=True, null=True),
        ),
    ]
