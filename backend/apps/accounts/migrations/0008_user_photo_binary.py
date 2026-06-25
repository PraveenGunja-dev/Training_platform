from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0007_add_setup_token_expires_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='photo_url',
            field=models.CharField(blank=True, max_length=300, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='photo_data',
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='photo_content_type',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
