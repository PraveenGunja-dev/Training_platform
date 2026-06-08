from __future__ import annotations

from celery import shared_task
from django.utils import timezone


@shared_task(name="apps.scheduling.tasks.send_class_start_reminders")
def send_class_start_reminders() -> int:
    """
    Runs every minute via Celery beat.
    Finds classes starting in 4–6 minutes and sends a 'CLASS_STARTING_SOON'
    in-app notification to every participant in the class's group.
    The dedupe_key prevents duplicate notifications if the task fires twice.
    """
    from datetime import timedelta

    from apps.groups.models import GroupMembership
    from apps.notifications.models import Notification
    from .models import Class

    now = timezone.now()
    window_start = now + timedelta(minutes=4)
    window_end   = now + timedelta(minutes=6)

    upcoming = list(
        Class.objects.select_related("group")
        .filter(
            starts_at__gte=window_start,
            starts_at__lte=window_end,
            status_cached="UPCOMING",
        )
    )

    if not upcoming:
        return 0

    total = 0
    for cls in upcoming:
        member_ids = list(
            GroupMembership.objects.filter(group_id=cls.group_id)
            .values_list("user_id", flat=True)
        )
        if not member_ids:
            continue

        starts_str = cls.starts_at.strftime("%I:%M %p")
        notifications = [
            Notification(
                user_id=uid,
                type="CLASS_STARTING_SOON",
                title=f"Class starting in 5 minutes",
                body=f'"{cls.title}" in {cls.group.name} starts at {starts_str}. Get ready!',
                link=f"/me/classes/{cls.id}",
                dedupe_key=f"class_starting_soon:{cls.id}:{uid}",
                sent_at=now,
                payload={"class_id": str(cls.id)},
            )
            for uid in member_ids
        ]
        created = Notification.objects.bulk_create(notifications, ignore_conflicts=True)
        total += len(created)

    return total


def notify_class_scheduled(cls) -> None:
    """
    Called immediately after a class is created.
    Sends a CLASS_SCHEDULED notification to all group participants.
    """
    from apps.groups.models import GroupMembership
    from apps.notifications.models import Notification

    now = timezone.now()
    member_ids = list(
        GroupMembership.objects.filter(group_id=cls.group_id)
        .values_list("user_id", flat=True)
    )
    if not member_ids:
        return

    starts_str = cls.starts_at.strftime("%d %b %Y, %I:%M %p")
    notifications = [
        Notification(
            user_id=uid,
            type="CLASS_SCHEDULED",
            title="New class scheduled",
            body=f'"{cls.title}" has been scheduled for {starts_str} in {cls.group.name}.',
            link=f"/me/classes/{cls.id}",
            dedupe_key=f"class_scheduled:{cls.id}:{uid}",
            sent_at=now,
            payload={"class_id": str(cls.id)},
        )
        for uid in member_ids
    ]
    Notification.objects.bulk_create(notifications, ignore_conflicts=True)
