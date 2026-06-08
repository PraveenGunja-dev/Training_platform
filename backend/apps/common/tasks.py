from __future__ import annotations

from celery import shared_task
from django.utils import timezone


@shared_task(name="apps.common.tasks.heartbeat")
def heartbeat() -> str:
    from apps.common.models import SchedulerHealth

    SchedulerHealth.objects.update_or_create(
        pk=1,
        defaults={"last_heartbeat_at": timezone.now()},
    )
    return "ok"
