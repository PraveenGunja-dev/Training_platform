from __future__ import annotations

from django.db.models import QuerySet

from .models import Class


def apply_class_filters(qs: QuerySet[Class], params: dict) -> QuerySet[Class]:
    group_id = params.get("group_id")
    from_date = params.get("from")
    to_date = params.get("to")
    status = params.get("status")

    if group_id:
        qs = qs.filter(group_id=group_id)
    if from_date:
        qs = qs.filter(starts_at__gte=from_date)
    if to_date:
        qs = qs.filter(ends_at__lte=to_date)
    if status:
        qs = qs.filter(status_cached=status)
    return qs
