import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

from apps.accounts.models import User

if not User.objects.filter(email="admin@ems.local").exists():
    User.objects.create_superuser(
        email="admin@ems.local",
        password="admin123",
        full_name="Admin",
    )
    print("Superuser created: admin@ems.local / admin123")
else:
    print("Superuser already exists: admin@ems.local")
