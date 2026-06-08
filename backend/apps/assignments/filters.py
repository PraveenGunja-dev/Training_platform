from __future__ import annotations

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.groups.models import GroupMembership

from .models import AssignmentTask


def apply_task_filters(qs: QuerySet, params: dict) -> QuerySet:
    group_id = params.get("group_id")
    class_id = params.get("class_id")
    is_open = params.get("is_open")
    if group_id:
        qs = qs.filter(group_id=group_id)
    if class_id:
        qs = qs.filter(class_obj_id=class_id)
    if is_open is not None:
        qs = qs.filter(is_open=is_open == "true")
    return qs


def participant_task_qs(user) -> QuerySet:
    """Return AssignmentTask rows visible to the given participant.

    A task is visible when the participant belongs to its group AND:
    - it has been explicitly opened (is_open=True), OR
    - the upload window has started (upload_open_at <= now) and the task
      is not yet closed — this handles environments where the Celery beat
      task has not yet flipped is_open (e.g. dev without a worker running).
    """
    now = timezone.now()
    group_ids = GroupMembership.objects.filter(user=user).values_list("group_id", flat=True)
    return (
        AssignmentTask.objects.filter(group_id__in=group_ids, is_closed=False)
        .filter(Q(is_open=True) | Q(upload_open_at__lte=now))
        .select_related("group")
    )
