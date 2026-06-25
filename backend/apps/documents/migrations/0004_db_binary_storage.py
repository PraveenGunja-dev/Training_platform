from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('documents', '0003_document_doc_type_freetext'),
    ]

    operations = [
        migrations.RemoveField(model_name='document', name='file_url'),
        migrations.AddField(
            model_name='document',
            name='file_data',
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.RemoveField(model_name='participantshareddoc', name='file_url'),
        migrations.AddField(
            model_name='participantshareddoc',
            name='file_data',
            field=models.BinaryField(blank=True, null=True),
        ),
    ]
