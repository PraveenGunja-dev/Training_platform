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
    
    if ist_start.hour == 9 and ist_start.minute == 0 and ist_end.hour == 18 and ist_end.minute == 0:
        new_starts_at = datetime(ist_start.year, ist_start.month, ist_start.day, 7, 30, 0, tzinfo=ist)
        new_ends_at = datetime(ist_start.year, ist_start.month, ist_start.day, 9, 30, 0, tzinfo=ist)
        cls.starts_at = new_starts_at
        cls.ends_at = new_ends_at
        cls.save(update_fields=['starts_at', 'ends_at'])
        updated += 1

print(f"Successfully updated {updated} classes to 07:30 AM - 09:30 AM.")
