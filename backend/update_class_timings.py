import os
import django

# Initialize Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django.setup()

from apps.scheduling.models import Class
from django.utils import timezone
from datetime import datetime

IST_OFFSET = timezone.timedelta(hours=5, minutes=30)
from datetime import timezone as dt_timezone
ist = dt_timezone(IST_OFFSET)

classes = Class.objects.all()
updated = 0
for cls in classes:
    ist_start = cls.starts_at.astimezone(ist)
    ist_end = cls.ends_at.astimezone(ist)
    
    # Update classes that currently have 07:30-09:30 timing to 07:45-09:45
    if ist_start.hour == 7 and ist_start.minute == 30 and ist_end.hour == 9 and ist_end.minute == 30:
        new_starts_at = datetime(ist_start.year, ist_start.month, ist_start.day, 7, 45, 0, tzinfo=ist)
        new_ends_at = datetime(ist_start.year, ist_start.month, ist_start.day, 9, 45, 0, tzinfo=ist)
        cls.starts_at = new_starts_at
        cls.ends_at = new_ends_at
        cls.save(update_fields=['starts_at', 'ends_at'])
        updated += 1

print(f"Successfully updated {updated} classes to 07:45 AM - 09:45 AM IST.")
