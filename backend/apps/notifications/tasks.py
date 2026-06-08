from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="apps.notifications.tasks.send_deadline_reminders")
def send_deadline_reminders() -> int:
    """
    Runs every minute via Celery beat.
    Fires DEADLINE_APPROACHING to assigned instructors for assignments
    whose deadline is 23h55m–24h05m away (10-minute window, idempotent via dedupe_key).
    """
    from apps.assignments.models import AssignmentTask
    from apps.notifications.services import notify_instructors

    now = timezone.now()
    window_start = now + timedelta(hours=23, minutes=55)
    window_end = now + timedelta(hours=24, minutes=5)

    tasks = list(
        AssignmentTask.objects.select_related("group")
        .filter(
            deadline_at__gte=window_start,
            deadline_at__lte=window_end,
            is_closed=False,
        )
    )
    if not tasks:
        return 0

    total = 0
    for task in tasks:
        from apps.assignments.models import Submission
        from apps.groups.models import GroupMembership

        member_count = GroupMembership.objects.filter(group_id=task.group_id).count()
        submitted = (
            Submission.objects.filter(task=task)
            .values("user_id")
            .distinct()
            .count()
        )
        pending = max(0, member_count - submitted)
        deadline_str = task.deadline_at.strftime("%d %b %Y, %I:%M %p")
        suffix = task.deadline_at.strftime("%Y%m%d")
        count = notify_instructors(
            group=task.group,
            notification_type="DEADLINE_APPROACHING",
            title=f"Deadline approaching: {task.title}",
            body=(
                f'Assignment "{task.title}" in {task.group.name} is due in 24 hours'
                f" ({deadline_str}). {pending} participant(s) haven't submitted yet."
            ),
            link=f"/instructor/assignments/{task.id}",
            payload={"task_id": str(task.id), "group_id": str(task.group_id)},
            dedupe_suffix=suffix,
        )
        total += count

    return total


@shared_task(name="apps.notifications.tasks.send_attendance_session_reminders")
def send_attendance_session_reminders() -> int:
    """
    Runs every minute via Celery beat.
    Fires ATTENDANCE_SESSION_REMINDER to assigned instructors for classes
    starting in 28–32 minutes (idempotent via dedupe_key).
    """
    from apps.notifications.services import notify_instructors
    from apps.scheduling.models import Class

    now = timezone.now()
    window_start = now + timedelta(minutes=28)
    window_end = now + timedelta(minutes=32)

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
        starts_str = cls.starts_at.strftime("%I:%M %p")
        suffix = cls.starts_at.strftime("%Y%m%d%H%M")
        count = notify_instructors(
            group=cls.group,
            notification_type="ATTENDANCE_SESSION_REMINDER",
            title=f"Class starting soon: {cls.title}",
            body=(
                f'Your class "{cls.title}" starts at {starts_str}. '
                "Remember to start the attendance session."
            ),
            link=f"/instructor/classes/{cls.id}",
            payload={"class_id": str(cls.id), "group_id": str(cls.group_id)},
            dedupe_suffix=suffix,
        )
        total += count

    return total
