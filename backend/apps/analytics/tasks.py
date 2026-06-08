from __future__ import annotations
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="apps.analytics.tasks.aggregate_daily")
def aggregate_daily() -> None:
    from apps.analytics.models import DashboardSnapshot
    from apps.analytics.services import compute_admin_payload

    today = timezone.now().date()
    payload = compute_admin_payload()
    DashboardSnapshot.objects.update_or_create(
        date=today,
        defaults={"payload": payload},
    )
    logger.info("aggregate_daily: snapshot saved for %s", today)
