from __future__ import annotations

from celery import shared_task
from django.utils import timezone


def _notify_task_opened(task, now) -> None:
    """Bulk-create TASK_OPENED in-app notifications for all group members."""
    from apps.groups.models import GroupMembership
    from apps.notifications.models import Notification

    member_ids = list(
        GroupMembership.objects.filter(group_id=task.group_id).values_list("user_id", flat=True)
    )
    if not member_ids:
        return

    notifications = [
        Notification(
            user_id=uid,
            type="TASK_OPENED",
            title=f"New task: {task.title}",
            body=f"'{task.title}' in {task.group.name} is now open for submissions.",
            link=f"/me/tasks/{task.id}",
            dedupe_key=f"task_opened:{task.id}:{uid}",
            sent_at=now,
            payload={"task_id": str(task.id)},
        )
        for uid in member_ids
    ]
    Notification.objects.bulk_create(notifications, ignore_conflicts=True)


@shared_task(name="apps.assignments.tasks.open_due_tasks")
def open_due_tasks() -> int:
    from apps.assignments.models import AssignmentTask

    now = timezone.now()
    tasks_to_open = list(
        AssignmentTask.objects.filter(
            upload_open_at__lte=now,
            is_open=False,
            is_closed=False,
        ).select_related("group")
    )
    if not tasks_to_open:
        return 0

    AssignmentTask.objects.filter(id__in=[t.id for t in tasks_to_open]).update(is_open=True)

    for task in tasks_to_open:
        _notify_task_opened(task, now)

    return len(tasks_to_open)
