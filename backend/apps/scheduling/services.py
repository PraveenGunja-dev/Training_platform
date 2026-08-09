from __future__ import annotations

from django.db.models import QuerySet

from .models import Class


def apply_class_filters(qs: QuerySet[Class], params: dict) -> QuerySet[Class]:
    group_id  = params.get("group_id")
    from_date = params.get("from")
    to_date   = params.get("to")
    status    = params.get("status")
    search    = params.get("search", "").strip()

    if group_id:
        qs = qs.filter(group_id=group_id)
    if from_date:
        from django.utils import timezone as _svc_tz  # noqa: PLC0415
        from datetime import datetime, time  # noqa: PLC0415
        try:
            _fd = datetime.strptime(from_date, "%Y-%m-%d").date()
            qs = qs.filter(starts_at__gte=_svc_tz.make_aware(datetime.combine(_fd, time.min)))
        except ValueError:
            pass
    if to_date:
        from django.utils import timezone as _svc_tz  # noqa: PLC0415
        from datetime import datetime, time  # noqa: PLC0415
        try:
            _td = datetime.strptime(to_date, "%Y-%m-%d").date()
            qs = qs.filter(starts_at__lte=_svc_tz.make_aware(datetime.combine(_td, time.max)))
        except ValueError:
            pass
    if status:
        from django.db.models import Case, When, Value, CharField  # noqa: PLC0415
        from django.utils import timezone as _filter_tz  # noqa: PLC0415
        _now = _filter_tz.now()
        qs = qs.annotate(
            live_status=Case(
                When(status_cached=Class.STATUS_CANCELLED, then=Value("CANCELLED")),
                When(status_cached=Class.STATUS_COMPLETED, then=Value("COMPLETED")),
                When(starts_at__lte=_now, ends_at__gte=_now, then=Value("ONGOING")),
                When(ends_at__lt=_now, then=Value("COMPLETED")),
                default=Value("UPCOMING"),
                output_field=CharField(),
            )
        ).filter(live_status=status)
    if search:
        qs = qs.filter(title__icontains=search)
    return qs
