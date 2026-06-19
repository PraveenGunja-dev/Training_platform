from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0002_document_description"),
    ]

    operations = [
        migrations.AlterField(
            model_name="document",
            name="doc_type",
            field=models.CharField(default="GUIDE", max_length=100),
        ),
    ]
