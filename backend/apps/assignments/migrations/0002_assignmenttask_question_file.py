from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assignments", "0001_initial"),
    ]
    operations = [
        migrations.AddField(model_name="assignmenttask", name="question_file_url", field=models.CharField(blank=True, default="", max_length=1000)),
        migrations.AddField(model_name="assignmenttask", name="question_file_name", field=models.CharField(blank=True, default="", max_length=255)),
        migrations.AddField(model_name="assignmenttask", name="question_file_type", field=models.CharField(blank=True, default="", max_length=100)),
        migrations.AddField(model_name="assignmenttask", name="question_file_size", field=models.PositiveBigIntegerField(blank=True, null=True)),
    ]
