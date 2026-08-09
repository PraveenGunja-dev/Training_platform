from __future__ import annotations

import re
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Max, Prefetch
from django.utils import timezone


def _natural_key(group) -> list:
    """Sort by the first number in the name, then full natural sort as tiebreaker."""
    m = re.search(r'\d+', group.name)
    first_num = int(m.group()) if m else 0
    rest = [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', group.name)]
    return [first_num] + rest


def compute_admin_payload(group_id: str | None = None) -> dict:
    from django.conf import settings as _s
    if getattr(_s, "CELERY_TASK_ALWAYS_EAGER", False):
        return _compute_admin_payload(group_id=group_id)
    cache_key = f"admin_dashboard_payload:{group_id or 'all'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    result = _compute_admin_payload(group_id=group_id)
    cache.set(cache_key, result, 30)
    return result


def _compute_admin_payload(group_id: str | None = None) -> dict:
    from apps.accounts.models import User
    from apps.assignments.models import AssignmentTask, Submission
    from apps.attendance.models import AttendanceRecord, AttendanceSession
    from apps.audit.models import AuditLog
    from apps.documents.models import ParticipantSharedDoc
    from apps.groups.models import ClassGroup, GroupMembership
    from apps.scheduling.models import Class

    now = timezone.now()
    today = now.date()

    _class_q = {"group_id": group_id} if group_id else {}
    _group_q = {"id": group_id} if group_id else {}

    # --- KPIs ---
    total_participants = User.objects.filter(role="PARTICIPANT", is_active=True).count()
    total_groups = ClassGroup.objects.filter(is_archived=False, **_group_q).count()
    classes_today = Class.objects.filter(starts_at__date=today, **_class_q).count()
    classes_upcoming = Class.objects.filter(starts_at__gt=now, **_class_q).exclude(status_cached="CANCELLED").count()
    classes_completed = Class.objects.filter(ends_at__lt=now, **_class_q).exclude(status_cached="CANCELLED").count()
    submitted = Submission.objects.filter(status="SUBMITTED").count()
    late = Submission.objects.filter(status="LATE_SUBMITTED").count()
    pending_approvals = ParticipantSharedDoc.objects.filter(status="PENDING").count()
    video_uploads = Submission.objects.filter(file_type__startswith="video/").count()
    doc_uploads = Submission.objects.filter(file_type="application/pdf").count()
    _open_per_group = {
        row["group_id"]: row["cnt"]
        for row in AssignmentTask.objects.filter(is_open=True, is_closed=False)
        .values("group_id").annotate(cnt=Count("id"))
    }
    _member_per_group = {
        row["group_id"]: row["cnt"]
        for row in GroupMembership.objects.filter(group__is_archived=False)
        .values("group_id").annotate(cnt=Count("id"))
    }
    total_submissions_expected = sum(
        _member_per_group.get(gid, 0) * cnt
        for gid, cnt in _open_per_group.items()
    )
    pending = max(0, total_submissions_expected - submitted - late)

    # --- 14-day upload trend ---
    trend_days = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        count = Submission.objects.filter(submitted_at__date=day).count()
        trend_days.append({"date": day.isoformat(), "count": count})

    # --- Attendance pie (last 30 days) ---
    thirty_days_ago = now - timedelta(days=30)
    recent_sessions = AttendanceSession.objects.filter(started_at__gte=thirty_days_ago)
    present_count = AttendanceRecord.objects.filter(session__in=recent_sessions).count()
    _session_group_ids = list(recent_sessions.values_list("class_obj__group_id", flat=True))
    _group_member_counts = {
        row["group_id"]: row["cnt"]
        for row in GroupMembership.objects.filter(group_id__in=set(_session_group_ids))
        .values("group_id")
        .annotate(cnt=Count("id"))
    } if _session_group_ids else {}
    total_possible = sum(_group_member_counts.get(gid, 0) for gid in _session_group_ids)
    absent_count = max(0, total_possible - present_count)
    attendance_pie = [
        {"label": "Present", "value": present_count},
        {"label": "Absent", "value": absent_count},
    ]

    # --- Submission bar (per group) ---
    groups = sorted(ClassGroup.objects.filter(is_archived=False, **_group_q), key=_natural_key)
    submission_bar = []
    for group in groups:
        grp_submitted = Submission.objects.filter(task__group=group, status="SUBMITTED").count()
        grp_late = Submission.objects.filter(task__group=group, status="LATE_SUBMITTED").count()
        member_count = GroupMembership.objects.filter(group=group).count()
        open_task_count = AssignmentTask.objects.filter(group=group, is_open=True).count()
        expected = member_count * open_task_count
        grp_pending = max(0, expected - grp_submitted - grp_late)
        submission_bar.append({
            "group_name": group.name,
            "submitted": grp_submitted,
            "pending": grp_pending,
            "late": grp_late,
        })

    # --- Group comparison (attendance rate vs submission rate) ---
    group_comparison = []
    for group in groups:
        g_members = GroupMembership.objects.filter(group=group).count()
        g_sessions = AttendanceSession.objects.filter(class_obj__group=group).count()
        g_records = AttendanceRecord.objects.filter(session__class_obj__group=group).count()
        att_rate = round(
            (g_records / (g_sessions * g_members) * 100) if g_sessions and g_members else 0, 1
        )
        g_open = AssignmentTask.objects.filter(group=group, is_open=True).count()
        g_submitted = (
            Submission.objects.filter(task__group=group)
            .values("user_id")
            .distinct()
            .count()
        )
        sub_rate = round(
            (g_submitted / (g_open * g_members) * 100) if g_open and g_members else 0, 1
        )
        group_comparison.append({
            "group_name": group.name,
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
        })

    # --- Class status distribution ---
    class_status = [
        {"label": "Upcoming",  "value": Class.objects.filter(starts_at__gt=now, **_class_q).exclude(status_cached="CANCELLED").count()},
        {"label": "Ongoing",   "value": Class.objects.filter(starts_at__lte=now, ends_at__gte=now, **_class_q).exclude(status_cached="CANCELLED").count()},
        {"label": "Completed", "value": Class.objects.filter(ends_at__lt=now, **_class_q).exclude(status_cached="CANCELLED").count()},
        {"label": "Cancelled", "value": Class.objects.filter(status_cached="CANCELLED", **_class_q).count()},
    ]

    # --- 4-week attendance & submission trend ---
    weekly_trend = []
    for week in range(3, -1, -1):
        w_end   = now - timedelta(weeks=week)
        w_start = w_end - timedelta(weeks=1)
        w_sessions = AttendanceSession.objects.filter(
            started_at__gte=w_start, started_at__lt=w_end
        )
        _w_group_ids = list(w_sessions.values_list("class_obj__group_id", flat=True))
        _w_group_counts = {
            row["group_id"]: row["cnt"]
            for row in GroupMembership.objects.filter(group_id__in=set(_w_group_ids))
            .values("group_id")
            .annotate(cnt=Count("id"))
        } if _w_group_ids else {}
        w_possible = sum(_w_group_counts.get(gid, 0) for gid in _w_group_ids)
        w_records = AttendanceRecord.objects.filter(
            session__started_at__gte=w_start, session__started_at__lt=w_end
        ).count()
        att_rate = round((w_records / w_possible * 100) if w_possible else 0, 1)

        w_submitted = Submission.objects.filter(
            submitted_at__gte=w_start, submitted_at__lt=w_end
        ).count()
        w_open = AssignmentTask.objects.filter(
            upload_open_at__lte=w_end, is_open=True
        ).count()
        w_members = User.objects.filter(role="PARTICIPANT", is_active=True).count()
        sub_rate = round(
            (w_submitted / (w_open * w_members) * 100) if w_open and w_members else 0, 1
        )
        label = f"W{4 - week}"
        weekly_trend.append({
            "week": label,
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
        })

    # --- Deadline tracking (next 5 open deadlines) ---
    upcoming_tasks = (
        AssignmentTask.objects.filter(is_open=True, deadline_at__gt=now)
        .select_related("group")
        .order_by("deadline_at")[:5]
    )
    deadline_tracking = []
    for task in upcoming_tasks:
        submitted_count = (
            Submission.objects.filter(task=task)
            .values("user_id")
            .distinct()
            .count()
        )
        total_members = GroupMembership.objects.filter(group=task.group).count()
        deadline_tracking.append({
            "task_title": task.title,
            "deadline_at": task.deadline_at.isoformat(),
            "pending_count": max(0, total_members - submitted_count),
        })

    # --- Recent activity from audit log ---
    recent_activity = []
    for log in AuditLog.objects.select_related("actor").order_by("-created_at")[:10]:
        recent_activity.append({
            "id": str(log.id),
            "actor_name": log.actor.full_name if log.actor else "System",
            "action": log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id),
            "created_at": log.created_at.isoformat(),
        })

    # --- Participant activity (up to 500 rows) ---
    # Precompute group-level aggregates to avoid N+1 (2 queries)
    _sessions_per_group = {
        row["class_obj__group_id"]: row["cnt"]
        for row in AttendanceSession.objects.values("class_obj__group_id").annotate(cnt=Count("id"))
    }
    _open_tasks_per_group = {
        row["group_id"]: row["cnt"]
        for row in AssignmentTask.objects.filter(is_open=True)
        .values("group_id").annotate(cnt=Count("id"))
    }

    participants = list(
        User.objects.filter(role="PARTICIPANT", is_active=True)
        .prefetch_related(
            Prefetch("group_memberships", queryset=GroupMembership.objects.select_related("group"))
        )[:500]
    )
    participant_ids = [p.id for p in participants]

    # Precompute user-level aggregates (3 queries)
    _attended_per_user = {
        row["user_id"]: row["cnt"]
        for row in AttendanceRecord.objects.filter(
            user_id__in=participant_ids,
            status=AttendanceRecord.STATUS_PRESENT,
        )
        .values("user_id").annotate(cnt=Count("id"))
    }
    _submitted_per_user = {
        row["user_id"]: row["cnt"]
        for row in Submission.objects.filter(user_id__in=participant_ids)
        .values("user_id").annotate(cnt=Count("task_id", distinct=True))
    }
    _last_submission_per_user = {
        row["user_id"]: row["latest"]
        for row in Submission.objects.filter(user_id__in=participant_ids)
        .values("user_id").annotate(latest=Max("submitted_at"))
    }

    participant_activity = []
    for p in participants:
        memberships = list(p.group_memberships.all())
        p_group_ids = [m.group_id for m in memberships]
        p_sessions = sum(_sessions_per_group.get(gid, 0) for gid in p_group_ids)
        p_attended = _attended_per_user.get(p.id, 0)
        att_rate = round((p_attended / p_sessions * 100) if p_sessions else 0, 1)

        p_open = sum(_open_tasks_per_group.get(gid, 0) for gid in p_group_ids)
        p_submitted = _submitted_per_user.get(p.id, 0)
        sub_rate = round((p_submitted / p_open * 100) if p_open else 0, 1)

        first_membership = memberships[0] if memberships else None
        group_name = first_membership.group.name if first_membership else "—"

        latest = _last_submission_per_user.get(p.id)
        last_activity = latest.isoformat() if latest else None

        participant_activity.append({
            "id": str(p.id),
            "name": p.full_name,
            "group_name": group_name,
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
            "last_activity": last_activity,
        })

    return {
        "kpis": {
            "total_participants": total_participants,
            "total_groups": total_groups,
            "classes_today": classes_today,
            "classes_upcoming": classes_upcoming,
            "classes_completed": classes_completed,
            "submitted": submitted,
            "pending": pending,
            "late": late,
            "total_submissions_expected": total_submissions_expected,
            "video_uploads": video_uploads,
            "doc_uploads": doc_uploads,
            "pending_approvals": pending_approvals,
        },
        "charts": {
            "attendance_pie": attendance_pie,
            "submission_bar": submission_bar,
            "group_comparison": group_comparison,
            "daily_upload_trend": trend_days,
            "deadline_tracking": deadline_tracking,
            "class_status": class_status,
            "weekly_trend": weekly_trend,
        },
        "recent_documents": [],
        "recent_activity": recent_activity,
        "participant_activity": participant_activity,
    }


def compute_sub_mentor_payload(user) -> dict:
    """Dashboard payload scoped to the Sub-Mentor's assigned groups."""
    from apps.assignments.models import AssignmentTask, Submission
    from apps.attendance.models import AttendanceRecord, AttendanceSession
    from apps.documents.models import ParticipantSharedDoc
    from apps.groups.models import ClassGroup, GroupSubMentor, GroupMembership
    from apps.scheduling.models import Class

    now = timezone.now()
    today = now.date()

    assigned_group_ids = list(
        GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    )
    _groups_qs = ClassGroup.objects.filter(pk__in=assigned_group_ids, is_archived=False)

    _class_q = {"group_id__in": assigned_group_ids}
    _group_q = {"pk__in": assigned_group_ids}

    total_participants = (
        GroupMembership.objects.filter(group_id__in=assigned_group_ids)
        .values("user_id").distinct().count()
    )
    total_groups = _groups_qs.count()
    groups = sorted(_groups_qs, key=_natural_key)
    classes_today = Class.objects.filter(starts_at__date=today, **_class_q).count()
    classes_upcoming = Class.objects.filter(starts_at__gt=now, **_class_q).exclude(status_cached="CANCELLED").count()
    classes_completed = Class.objects.filter(ends_at__lt=now, **_class_q).exclude(status_cached="CANCELLED").count()
    submitted = Submission.objects.filter(task__group_id__in=assigned_group_ids, status="SUBMITTED").count()
    late = Submission.objects.filter(task__group_id__in=assigned_group_ids, status="LATE_SUBMITTED").count()
    pending_approvals = ParticipantSharedDoc.objects.filter(
        group_id__in=assigned_group_ids, status="PENDING"
    ).count()
    _sm_open_per_group = {
        row["group_id"]: row["cnt"]
        for row in AssignmentTask.objects.filter(
            group_id__in=assigned_group_ids, is_open=True, is_closed=False
        ).values("group_id").annotate(cnt=Count("id"))
    }
    _sm_member_per_group = {
        row["group_id"]: row["cnt"]
        for row in GroupMembership.objects.filter(group_id__in=assigned_group_ids)
        .values("group_id").annotate(cnt=Count("id"))
    }
    total_submissions_expected = sum(
        _sm_member_per_group.get(gid, 0) * cnt
        for gid, cnt in _sm_open_per_group.items()
    )
    pending = max(0, total_submissions_expected - submitted - late)

    # 14-day upload trend
    trend_days = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        count = Submission.objects.filter(
            task__group_id__in=assigned_group_ids, submitted_at__date=day
        ).count()
        trend_days.append({"date": day.isoformat(), "count": count})

    # Attendance pie (last 30 days) — proper absent calculation
    thirty_days_ago = now - timedelta(days=30)
    recent_sessions = AttendanceSession.objects.filter(
        class_obj__group_id__in=assigned_group_ids, started_at__gte=thirty_days_ago
    )
    present_count = AttendanceRecord.objects.filter(session__in=recent_sessions).count()
    _sess_group_ids = list(recent_sessions.values_list("class_obj__group_id", flat=True))
    _grp_member_counts = {
        row["group_id"]: row["cnt"]
        for row in GroupMembership.objects.filter(group_id__in=set(_sess_group_ids))
        .values("group_id").annotate(cnt=Count("id"))
    } if _sess_group_ids else {}
    total_possible = sum(_grp_member_counts.get(gid, 0) for gid in _sess_group_ids)
    absent_count = max(0, total_possible - present_count)
    attendance_pie = [
        {"label": "Present", "value": present_count},
        {"label": "Absent", "value": absent_count},
    ]

    # Submission bar (per group)
    submission_bar = []
    for group in groups:
        grp_submitted = Submission.objects.filter(task__group=group, status="SUBMITTED").count()
        grp_late = Submission.objects.filter(task__group=group, status="LATE_SUBMITTED").count()
        member_count = GroupMembership.objects.filter(group=group).count()
        open_task_count = AssignmentTask.objects.filter(group=group, is_open=True).count()
        expected = member_count * open_task_count
        grp_pending = max(0, expected - grp_submitted - grp_late)
        submission_bar.append({
            "group_name": group.name,
            "submitted": grp_submitted,
            "pending": grp_pending,
            "late": grp_late,
        })

    # Group comparison (attendance % vs submission %) per assigned group
    group_comparison = []
    for group in groups:
        g_members = GroupMembership.objects.filter(group=group).count()
        g_sessions = AttendanceSession.objects.filter(class_obj__group=group).count()
        g_records = AttendanceRecord.objects.filter(session__class_obj__group=group).count()
        att_rate = round(
            (g_records / (g_sessions * g_members) * 100) if g_sessions and g_members else 0, 1
        )
        g_open = AssignmentTask.objects.filter(group=group, is_open=True).count()
        g_submitted = (
            Submission.objects.filter(task__group=group)
            .values("user_id").distinct().count()
        )
        sub_rate = round(
            (g_submitted / (g_open * g_members) * 100) if g_open and g_members else 0, 1
        )
        group_comparison.append({
            "group_name": group.name,
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
        })

    # 4-week attendance & submission trend (scoped to Sub-Mentor's groups)
    weekly_trend = []
    for week in range(3, -1, -1):
        w_end   = now - timedelta(weeks=week)
        w_start = w_end - timedelta(weeks=1)
        w_sessions = AttendanceSession.objects.filter(
            class_obj__group_id__in=assigned_group_ids,
            started_at__gte=w_start, started_at__lt=w_end,
        )
        _w_group_ids = list(w_sessions.values_list("class_obj__group_id", flat=True))
        _w_group_counts = {
            row["group_id"]: row["cnt"]
            for row in GroupMembership.objects.filter(group_id__in=set(_w_group_ids))
            .values("group_id").annotate(cnt=Count("id"))
        } if _w_group_ids else {}
        w_possible = sum(_w_group_counts.get(gid, 0) for gid in _w_group_ids)
        w_records = AttendanceRecord.objects.filter(
            session__class_obj__group_id__in=assigned_group_ids,
            session__started_at__gte=w_start, session__started_at__lt=w_end,
        ).count()
        att_rate = round((w_records / w_possible * 100) if w_possible else 0, 1)

        w_submitted = Submission.objects.filter(
            task__group_id__in=assigned_group_ids,
            submitted_at__gte=w_start, submitted_at__lt=w_end,
        ).count()
        w_open = AssignmentTask.objects.filter(
            group_id__in=assigned_group_ids,
            upload_open_at__lte=w_end, is_open=True,
        ).count()
        w_members = (
            GroupMembership.objects.filter(group_id__in=assigned_group_ids)
            .values("user_id").distinct().count()
        )
        sub_rate = round(
            (w_submitted / (w_open * w_members) * 100) if w_open and w_members else 0, 1
        )
        weekly_trend.append({
            "week": f"W{4 - week}",
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
        })

    # Deadline tracking (next 5 open deadlines in assigned groups)
    upcoming_tasks = (
        AssignmentTask.objects.filter(
            group_id__in=assigned_group_ids, is_open=True, deadline_at__gt=now
        )
        .select_related("group")
        .order_by("deadline_at")[:5]
    )
    deadline_tracking = []
    for task in upcoming_tasks:
        submitted_count = (
            Submission.objects.filter(task=task).values("user_id").distinct().count()
        )
        total_members = GroupMembership.objects.filter(group=task.group).count()
        deadline_tracking.append({
            "task_title": task.title,
            "deadline_at": task.deadline_at.isoformat(),
            "pending_count": max(0, total_members - submitted_count),
        })

    # Class status distribution
    class_status = [
        {"label": "Upcoming",  "value": Class.objects.filter(starts_at__gt=now, **_class_q).exclude(status_cached="CANCELLED").count()},
        {"label": "Ongoing",   "value": Class.objects.filter(starts_at__lte=now, ends_at__gte=now, **_class_q).exclude(status_cached="CANCELLED").count()},
        {"label": "Completed", "value": Class.objects.filter(ends_at__lt=now, **_class_q).exclude(status_cached="CANCELLED").count()},
        {"label": "Cancelled", "value": Class.objects.filter(status_cached="CANCELLED", **_class_q).count()},
    ]

    # Recent activity scoped to Sub-Mentor's groups (class + attendance + assignment events)
    from apps.audit.models import AuditLog  # noqa: PLC0415
    class_ids = list(Class.objects.filter(**_class_q).values_list("id", flat=True))
    class_id_strs = [str(c) for c in class_ids]
    from django.db.models import Q as _Q  # noqa: PLC0415
    recent_activity = []
    activity_qs = (
        AuditLog.objects.filter(
            _Q(target_type="Class", target_id__in=class_id_strs) |
            _Q(target_type="AttendanceSession", metadata__class_id__in=class_id_strs) |
            _Q(target_type="AssignmentTask", metadata__group_id__in=[str(g) for g in assigned_group_ids])
        )
        .select_related("actor")
        .order_by("-created_at")[:10]
    )
    for log in activity_qs:
        recent_activity.append({
            "id": str(log.id),
            "actor_name": log.actor.full_name if log.actor else "System",
            "action": log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id),
            "created_at": log.created_at.isoformat(),
        })

    # --- Participant activity scoped to Sub-Mentor's groups ---
    _sessions_per_group = {
        row["class_obj__group_id"]: row["cnt"]
        for row in AttendanceSession.objects.filter(class_obj__group_id__in=assigned_group_ids)
        .values("class_obj__group_id").annotate(cnt=Count("id"))
    }
    _open_tasks_per_group = {
        row["group_id"]: row["cnt"]
        for row in AssignmentTask.objects.filter(is_open=True, group_id__in=assigned_group_ids)
        .values("group_id").annotate(cnt=Count("id"))
    }
    from apps.accounts.models import User
    participants = list(
        User.objects.filter(
            role="PARTICIPANT",
            is_active=True,
            group_memberships__group_id__in=assigned_group_ids,
        )
        .distinct()
        .prefetch_related(
            Prefetch(
                "group_memberships",
                queryset=GroupMembership.objects.filter(
                    group_id__in=assigned_group_ids
                ).select_related("group"),
            )
        )[:500]
    )
    participant_ids = [p.id for p in participants]
    _attended_per_user = {
        row["user_id"]: row["cnt"]
        for row in AttendanceRecord.objects.filter(
            user_id__in=participant_ids,
            session__class_obj__group_id__in=assigned_group_ids,
            status=AttendanceRecord.STATUS_PRESENT,
        ).values("user_id").annotate(cnt=Count("id"))
    }
    _submitted_per_user = {
        row["user_id"]: row["cnt"]
        for row in Submission.objects.filter(
            user_id__in=participant_ids,
            task__group_id__in=assigned_group_ids,
        ).values("user_id").annotate(cnt=Count("task_id", distinct=True))
    }
    _last_submission_per_user = {
        row["user_id"]: row["latest"]
        for row in Submission.objects.filter(
            user_id__in=participant_ids,
            task__group_id__in=assigned_group_ids,
        ).values("user_id").annotate(latest=Max("submitted_at"))
    }
    participant_activity = []
    for p in participants:
        memberships = list(p.group_memberships.all())
        p_group_ids = [m.group_id for m in memberships]
        p_sessions = sum(_sessions_per_group.get(gid, 0) for gid in p_group_ids)
        p_attended = _attended_per_user.get(p.id, 0)
        att_rate = round((p_attended / p_sessions * 100) if p_sessions else 0, 1)
        p_open = sum(_open_tasks_per_group.get(gid, 0) for gid in p_group_ids)
        p_submitted = _submitted_per_user.get(p.id, 0)
        sub_rate = round((p_submitted / p_open * 100) if p_open else 0, 1)
        first_membership = memberships[0] if memberships else None
        group_name = first_membership.group.name if first_membership else "—"
        latest = _last_submission_per_user.get(p.id)
        participant_activity.append({
            "id": str(p.id),
            "name": p.full_name,
            "group_name": group_name,
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
            "last_activity": latest.isoformat() if latest else None,
        })

    return {
        "kpis": {
            "total_participants": total_participants,
            "total_groups": total_groups,
            "classes_today": classes_today,
            "classes_upcoming": classes_upcoming,
            "classes_completed": classes_completed,
            "submitted": submitted,
            "pending": pending,
            "late": late,
            "total_submissions_expected": total_submissions_expected,
            "video_uploads": 0,
            "doc_uploads": 0,
            "pending_approvals": pending_approvals,
        },
        "charts": {
            "attendance_pie": attendance_pie,
            "submission_bar": submission_bar,
            "group_comparison": group_comparison,
            "daily_upload_trend": trend_days,
            "deadline_tracking": deadline_tracking,
            "class_status": class_status,
            "weekly_trend": weekly_trend,
        },
        "recent_documents": [],
        "recent_activity": recent_activity,
        "participant_activity": participant_activity,
    }


def compute_participant_payload(user) -> dict:
    from apps.assignments.models import AssignmentTask, Submission
    from apps.assignments.serializers import AssignmentTaskSerializer, SubmissionSerializer
    from apps.attendance.models import AttendanceRecord, AttendanceSession
    from apps.attendance.serializers import AttendanceSessionSerializer
    from apps.documents.models import Document
    from apps.documents.serializers import DocumentSerializer
    from apps.groups.models import GroupMembership
    from apps.scheduling.models import Class

    now = timezone.now()

    group_ids = list(
        GroupMembership.objects.filter(user=user).values_list("group_id", flat=True)
    )

    # --- Featured class: nearest upcoming/ongoing first, then most-recent completed ---
    today_class = (
        Class.objects.filter(group_id__in=group_ids, ends_at__gte=now)
        .exclude(status_cached="CANCELLED")
        .select_related("group")
        .order_by("starts_at")
        .first()
    )
    if not today_class:
        today_class = (
            Class.objects.filter(group_id__in=group_ids, ends_at__lt=now)
            .exclude(status_cached="CANCELLED")
            .select_related("group")
            .order_by("-ends_at")
            .first()
        )

    today_data: dict = {"class": None, "attendance_status": None, "mark_attendance_open": False}
    if today_class:
        active_session = AttendanceSession.objects.filter(
            class_obj=today_class, status="ACTIVE"
        ).select_related("started_by", "ended_by", "class_obj__group").first()
        my_record = None
        if active_session:
            my_record = AttendanceRecord.objects.filter(
                session=active_session, user=user
            ).first()

        today_data = {
            "class": {
                "id": str(today_class.id),
                "group_id": str(today_class.group_id),
                "group_name": today_class.group.name,
                "title": today_class.title,
                "description": today_class.description,
                "starts_at": today_class.starts_at.isoformat(),
                "ends_at": today_class.ends_at.isoformat(),
                "attendance_open_at": (
                    today_class.attendance_open_at.isoformat()
                    if today_class.attendance_open_at
                    else None
                ),
                "attendance_close_at": (
                    today_class.attendance_close_at.isoformat()
                    if today_class.attendance_close_at
                    else None
                ),
                "allow_late_attendance": today_class.allow_late_attendance,
                "status": today_class.computed_status,
                "active_session": (
                    AttendanceSessionSerializer(active_session).data
                    if active_session
                    else None
                ),
                "my_record": {
                    "id": str(my_record.id),
                    "session_id": str(my_record.session_id),
                    "user_id": str(user.id),
                    "marked_at": my_record.marked_at.isoformat(),
                    "status": my_record.status,
                }
                if my_record
                else None,
            },
            "attendance_status": None,
            "mark_attendance_open": bool(active_session),
        }

    # --- Pending tasks (open, not yet submitted by this user) ---
    submitted_task_ids = set(
        Submission.objects.filter(user=user).values_list("task_id", flat=True)
    )
    pending_qs = (
        AssignmentTask.objects.filter(group_id__in=group_ids, is_open=True, is_closed=False)
        .exclude(id__in=submitted_task_ids)
        .order_by("deadline_at")[:10]
    )
    pending_tasks = list(AssignmentTaskSerializer(pending_qs, many=True).data)

    # --- Quick stats ---
    total_sessions = AttendanceSession.objects.filter(
        class_obj__group_id__in=group_ids
    ).count()
    attended = AttendanceRecord.objects.filter(
        user=user,
        session__class_obj__group_id__in=group_ids,
        status=AttendanceRecord.STATUS_PRESENT,
    ).count()
    attendance_rate = round(min((attended / total_sessions * 100) if total_sessions else 0, 100))
    submitted_count = (
        Submission.objects.filter(user=user).values("task_id").distinct().count()
    )
    pending_count = len(pending_tasks)

    # --- Recent submissions (last 5, proper serializer shape) ---
    recent_subs_qs = (
        Submission.objects.filter(user=user)
        .select_related("task", "user", "submitted_by")
        .order_by("-submitted_at")[:5]
    )
    recent_submissions = list(SubmissionSerializer(recent_subs_qs, many=True).data)

    # --- Recent documents visible to this participant ---
    recent_docs_qs = (
        Document.objects.filter(
            group_id__in=group_ids,
            visibility__in=["GROUP", "PUBLIC_TO_CLASS"],
        )
        .order_by("-created_at")[:5]
    )
    recent_documents = list(DocumentSerializer(recent_docs_qs, many=True).data)

    return {
        "today": today_data,
        "quick_stats": {
            "attendance_rate": attendance_rate,
            "submitted_count": submitted_count,
            "pending_count": pending_count,
        },
        "pending_tasks": pending_tasks,
        "recent_submissions": recent_submissions,
        "recent_documents": recent_documents,
    }


def compute_lead_mentor_payload(group_id: str) -> dict:
    from apps.accounts.models import User
    from apps.assignments.models import AssignmentTask, Submission
    from apps.attendance.models import AttendanceRecord, AttendanceSession
    from apps.documents.models import ParticipantSharedDoc
    from apps.groups.models import ClassGroup, GroupLeadMentor, GroupSubMentor, GroupMembership, SubGroup
    from apps.scheduling.models import Class

    now = timezone.now()
    today = now.date()

    group = ClassGroup.objects.filter(pk=group_id).first()
    group_name = group.name if group else ""

    # KPIs
    total_participants = GroupMembership.objects.filter(group_id=group_id).values("user_id").distinct().count()
    total_sub_mentors = GroupSubMentor.objects.filter(group_id=group_id).count()
    total_sub_groups = SubGroup.objects.filter(parent_group_id=group_id).count()
    total_assignments = AssignmentTask.objects.filter(group_id=group_id).count()
    classes_today = Class.objects.filter(group_id=group_id, starts_at__date=today).count()
    classes_upcoming = Class.objects.filter(group_id=group_id, starts_at__gt=now).exclude(status_cached="CANCELLED").count()
    classes_completed = Class.objects.filter(group_id=group_id, ends_at__lt=now).exclude(status_cached="CANCELLED").count()
    submitted = Submission.objects.filter(task__group_id=group_id, status="SUBMITTED").count()
    late = Submission.objects.filter(task__group_id=group_id, status="LATE_SUBMITTED").count()
    pending_approvals = ParticipantSharedDoc.objects.filter(group_id=group_id, status="PENDING").count()
    open_tasks_count = AssignmentTask.objects.filter(group_id=group_id, is_open=True, is_closed=False).count()
    total_submissions_expected = total_participants * open_tasks_count
    pending = max(0, total_submissions_expected - submitted - late)

    # Attendance pie (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    recent_sessions = AttendanceSession.objects.filter(
        class_obj__group_id=group_id, started_at__gte=thirty_days_ago
    )
    present_count = AttendanceRecord.objects.filter(session__in=recent_sessions).count()
    total_possible = total_participants * recent_sessions.count()
    absent_count = max(0, total_possible - present_count)
    attendance_pie = [
        {"label": "Present", "value": present_count},
        {"label": "Absent", "value": absent_count},
    ]

    # Class status
    class_status = [
        {"label": "Upcoming",  "value": Class.objects.filter(group_id=group_id, starts_at__gt=now).exclude(status_cached="CANCELLED").count()},
        {"label": "Ongoing",   "value": Class.objects.filter(group_id=group_id, starts_at__lte=now, ends_at__gte=now).exclude(status_cached="CANCELLED").count()},
        {"label": "Completed", "value": Class.objects.filter(group_id=group_id, ends_at__lt=now).exclude(status_cached="CANCELLED").count()},
        {"label": "Cancelled", "value": Class.objects.filter(group_id=group_id, status_cached="CANCELLED").count()},
    ]

    # 4-week attendance & submission trend
    weekly_trend = []
    member_count = total_participants
    for week in range(3, -1, -1):
        w_end   = now - timedelta(weeks=week)
        w_start = w_end - timedelta(weeks=1)
        w_sessions = AttendanceSession.objects.filter(
            class_obj__group_id=group_id, started_at__gte=w_start, started_at__lt=w_end
        )
        w_possible = member_count * w_sessions.count()
        w_records = AttendanceRecord.objects.filter(session__in=w_sessions).count()
        att_rate = round((w_records / w_possible * 100) if w_possible else 0, 1)

        w_open = AssignmentTask.objects.filter(
            group_id=group_id, upload_open_at__lte=w_end, is_open=True
        ).count()
        w_submitted = Submission.objects.filter(
            task__group_id=group_id, submitted_at__gte=w_start, submitted_at__lt=w_end
        ).count()
        sub_rate = round((w_submitted / (w_open * member_count) * 100) if w_open and member_count else 0, 1)
        weekly_trend.append({
            "week": f"W{4 - week}",
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
        })

    # Deadline tracking (next 5 open deadlines)
    upcoming_tasks = (
        AssignmentTask.objects.filter(group_id=group_id, is_open=True, deadline_at__gt=now)
        .order_by("deadline_at")[:5]
    )
    deadline_tracking = []
    for task in upcoming_tasks:
        submitted_count = Submission.objects.filter(task=task).values("user_id").distinct().count()
        deadline_tracking.append({
            "task_title": task.title,
            "deadline_at": task.deadline_at.isoformat(),
            "pending_count": max(0, total_participants - submitted_count),
        })

    # Participant activity
    _sessions_count = AttendanceSession.objects.filter(class_obj__group_id=group_id).count()
    _open_tasks_count = AssignmentTask.objects.filter(group_id=group_id, is_open=True).count()

    participants = list(
        User.objects.filter(
            role="PARTICIPANT",
            is_active=True,
            group_memberships__group_id=group_id,
        ).distinct()[:500]
    )
    participant_ids = [p.id for p in participants]

    _attended_per_user = {
        row["user_id"]: row["cnt"]
        for row in AttendanceRecord.objects.filter(
            user_id__in=participant_ids,
            session__class_obj__group_id=group_id,
            status=AttendanceRecord.STATUS_PRESENT,
        ).values("user_id").annotate(cnt=Count("id"))
    }
    _submitted_per_user = {
        row["user_id"]: row["cnt"]
        for row in Submission.objects.filter(
            user_id__in=participant_ids,
            task__group_id=group_id,
        ).values("user_id").annotate(cnt=Count("task_id", distinct=True))
    }
    _last_submission_per_user = {
        row["user_id"]: row["latest"]
        for row in Submission.objects.filter(
            user_id__in=participant_ids,
            task__group_id=group_id,
        ).values("user_id").annotate(latest=Max("submitted_at"))
    }

    participant_activity = []
    for p in participants:
        p_attended = _attended_per_user.get(p.id, 0)
        att_rate = round((p_attended / _sessions_count * 100) if _sessions_count else 0, 1)
        p_submitted = _submitted_per_user.get(p.id, 0)
        sub_rate = round((p_submitted / _open_tasks_count * 100) if _open_tasks_count else 0, 1)
        latest = _last_submission_per_user.get(p.id)
        participant_activity.append({
            "id": str(p.id),
            "name": p.full_name,
            "group_name": group_name,
            "attendance_rate": min(100.0, att_rate),
            "submission_rate": min(100.0, sub_rate),
            "last_activity": latest.isoformat() if latest else None,
        })

    return {
        "group_name": group_name,
        "kpis": {
            "total_participants": total_participants,
            "total_sub_mentors": total_sub_mentors,
            "total_sub_groups": total_sub_groups,
            "total_assignments": total_assignments,
            "classes_today": classes_today,
            "classes_upcoming": classes_upcoming,
            "classes_completed": classes_completed,
            "submitted": submitted,
            "pending": pending,
            "late": late,
            "pending_approvals": pending_approvals,
            "total_submissions_expected": total_submissions_expected,
        },
        "charts": {
            "attendance_pie": attendance_pie,
            "class_status": class_status,
            "weekly_trend": weekly_trend,
            "deadline_tracking": deadline_tracking,
        },
        "participant_activity": participant_activity,
    }


def compute_batch_breakdown() -> dict:
    """
    Returns per-batch KPI breakdown and day-wise attendance data (last 14 days)
    for the admin dashboard breakdown panel.
    """
    import datetime as _dt
    from collections import defaultdict

    from apps.assignments.models import AssignmentTask, Submission
    from apps.attendance.models import AttendanceRecord, AttendanceSession
    from apps.groups.models import ClassGroup, GroupMembership
    from apps.scheduling.models import Class

    now = timezone.now()
    today = now.date()

    groups = sorted(ClassGroup.objects.filter(is_archived=False), key=_natural_key)

    # --- Membership counts (1 query) ---
    membership_counts = {
        row["group_id"]: row["cnt"]
        for row in GroupMembership.objects.filter(group__is_archived=False)
        .values("group_id")
        .annotate(cnt=Count("id"))
    }

    # --- Submission counts (3 queries) ---
    submitted_per_group = {
        row["task__group_id"]: row["cnt"]
        for row in Submission.objects.filter(status="SUBMITTED")
        .values("task__group_id")
        .annotate(cnt=Count("id"))
    }
    late_per_group = {
        row["task__group_id"]: row["cnt"]
        for row in Submission.objects.filter(status="LATE_SUBMITTED")
        .values("task__group_id")
        .annotate(cnt=Count("id"))
    }
    open_tasks_per_group = {
        row["group_id"]: row["cnt"]
        for row in AssignmentTask.objects.filter(is_open=True, is_closed=False)
        .values("group_id")
        .annotate(cnt=Count("id"))
    }

    # --- Class counts (2 queries) ---
    classes_today_per_group = {
        row["group_id"]: row["cnt"]
        for row in Class.objects.filter(starts_at__date=today)
        .values("group_id")
        .annotate(cnt=Count("id"))
    }
    year_end_2026 = _dt.datetime(2026, 12, 31, 23, 59, 59, tzinfo=_dt.timezone.utc)
    classes_upcoming_per_group = {
        row["group_id"]: row["cnt"]
        for row in Class.objects.filter(
            starts_at__gt=now,
            starts_at__lte=year_end_2026,
        )
        .exclude(status_cached="CANCELLED")
        .values("group_id")
        .annotate(cnt=Count("id"))
    }

    # --- Breakdown list ---
    breakdown = []
    for group in groups:
        group_id = group.id
        participants_count = membership_counts.get(group_id, 0)
        grp_submitted = submitted_per_group.get(group_id, 0)
        grp_late = late_per_group.get(group_id, 0)
        grp_open = open_tasks_per_group.get(group_id, 0)
        expected = participants_count * grp_open
        grp_pending = max(0, expected - grp_submitted - grp_late)

        breakdown.append({
            "group_id": str(group_id),
            "group_name": group.name,
            "participants_count": participants_count,
            "classes_today": classes_today_per_group.get(group_id, 0),
            "classes_upcoming": classes_upcoming_per_group.get(group_id, 0),
            "submitted": grp_submitted,
            "pending": grp_pending,
            "late_submissions": grp_late,
        })

    # --- Day-wise attendance per batch (last 14 days) ---
    date_range = [today - timedelta(days=i) for i in range(13, -1, -1)]  # oldest first

    window_start = _dt.datetime.combine(date_range[0], _dt.time.min).replace(tzinfo=_dt.timezone.utc)
    window_end   = _dt.datetime.combine(today, _dt.time.max).replace(tzinfo=_dt.timezone.utc)

    sessions_in_window = list(
        AttendanceSession.objects.filter(
            started_at__gte=window_start,
            started_at__lte=window_end,
        )
        .values("id", "class_obj__group_id", "started_at__date")
    )

    # Map session_id -> (group_id, date)
    session_meta = {
        row["id"]: (row["class_obj__group_id"], row["started_at__date"])
        for row in sessions_in_window
    }
    session_ids = list(session_meta.keys())

    # Group+date pairs that had at least one session
    session_day_set: set = {
        (group_id, session_date)
        for group_id, session_date in session_meta.values()
    }

    # Fetch record counts per (session_id, status) in 1 query
    records_by_session_status: dict = {}
    if session_ids:
        for row in (
            AttendanceRecord.objects.filter(session_id__in=session_ids)
            .values("session_id", "status")
            .annotate(cnt=Count("id"))
        ):
            records_by_session_status[(row["session_id"], row["status"])] = row["cnt"]

    # Aggregate per (group_id, date)
    agg: dict = defaultdict(lambda: defaultdict(int))
    for session_id, (group_id, session_date) in session_meta.items():
        agg[(group_id, session_date)]["present"] += records_by_session_status.get(
            (session_id, "PRESENT"), 0
        )
        agg[(group_id, session_date)]["late"] += records_by_session_status.get(
            (session_id, "LATE"), 0
        )

    # Build attendance_by_batch
    attendance_by_batch = []
    for group in groups:
        group_id = group.id
        total_participants = membership_counts.get(group_id, 0)
        daily = []
        for day in date_range:
            had_session = (group_id, day) in session_day_set
            day_present = agg[(group_id, day)]["present"]
            day_late    = agg[(group_id, day)]["late"]
            day_absent  = max(0, total_participants - day_present - day_late) if had_session else 0
            daily.append({
                "date": day.isoformat(),
                "present": day_present,
                "absent": day_absent,
                "late": day_late,
            })

        attendance_by_batch.append({
            "group_id": str(group_id),
            "group_name": group.name,
            "total_participants": total_participants,
            "daily": daily,
        })

    return {
        "breakdown": breakdown,
        "attendance_by_batch": attendance_by_batch,
    }


def compute_feedback_analytics(filters: dict) -> dict:
    """
    Returns feedback analytics aggregated across all classes matching the given filters.

    Supported filter keys (all optional):
      - batch_id   (str | UUID)  — filter to a specific ClassGroup.id
      - class_id   (str | UUID)  — filter to a specific Class.id
      - mentor_id  (str | UUID)  — filter to classes whose group has this user as Sub-Mentor
                                   (matches GroupSubMentor.sub_mentor_id)
      - date_from  (str, ISO date "YYYY-MM-DD") — include classes with starts_at >= this date
      - date_to    (str, ISO date "YYYY-MM-DD") — include classes with starts_at <= this date

    Return shape:
    {
        "summary": {
            "total_feedback_count": int,
            "average_rating": float | None,   # None if no feedback exists
            "response_rate": float | None,    # submitted / enrolled * 100, None if 0 enrolled
        },
        "rating_distribution": [
            {"rating": "1.0", "count": int},
            ...
        ],
        "per_batch": [...],
        "top_classes": [...],
        "bottom_classes": [...],
    }
    """
    from django.db.models import Avg, Count

    from apps.feedback.models import ClassFeedback
    from apps.groups.models import ClassGroup, GroupMembership, GroupSubMentor
    from apps.scheduling.models import Class

    # --- Build the class queryset from filters ---
    class_qs = Class.objects.select_related("group")

    batch_id = filters.get("batch_id")
    class_id = filters.get("class_id")
    mentor_id = filters.get("mentor_id")
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")

    if batch_id:
        class_qs = class_qs.filter(group_id=batch_id)
    if class_id:
        class_qs = class_qs.filter(id=class_id)
    if mentor_id:
        group_ids_for_mentor = list(
            GroupSubMentor.objects.filter(sub_mentor_id=mentor_id)
            .values_list("group_id", flat=True)
        )
        class_qs = class_qs.filter(group_id__in=group_ids_for_mentor)
    if date_from:
        class_qs = class_qs.filter(starts_at__date__gte=date_from)
    if date_to:
        class_qs = class_qs.filter(starts_at__date__lte=date_to)

    class_ids = list(class_qs.values_list("id", flat=True))

    # --- Aggregate feedback for matched classes ---
    feedback_qs = ClassFeedback.objects.filter(class_session_id__in=class_ids)

    total_feedback = feedback_qs.count()
    agg = feedback_qs.aggregate(avg=Avg("rating"))
    average_rating = round(float(agg["avg"]), 2) if agg["avg"] is not None else None

    # Response rate: total submitted vs total enrolled across all matched class groups
    group_ids = list(class_qs.values_list("group_id", flat=True).distinct())
    enrolled_count = GroupMembership.objects.filter(group_id__in=group_ids).values("user_id").distinct().count()
    response_rate = (
        round(total_feedback / enrolled_count * 100, 1) if enrolled_count else None
    )

    # --- Rating distribution (all 9 half-star buckets, always present) ---
    BUCKETS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"]
    bucket_counts = {
        str(row["rating"]): row["cnt"]
        for row in feedback_qs.values("rating").annotate(cnt=Count("id"))
    }
    rating_distribution = [
        {"bucket": b, "count": bucket_counts.get(b, 0)}
        for b in BUCKETS
    ]

    # --- Per-batch breakdown ---
    per_batch_avg = []
    groups = ClassGroup.objects.filter(id__in=group_ids)
    batch_feedback_agg = {
        row["class_session__group_id"]: {"count": row["cnt"], "avg": row["avg"]}
        for row in feedback_qs.values("class_session__group_id").annotate(
            cnt=Count("id"), avg=Avg("rating")
        )
    }
    batch_enrolled = {
        row["group_id"]: row["cnt"]
        for row in GroupMembership.objects.filter(group_id__in=group_ids)
        .values("group_id").annotate(cnt=Count("user_id", distinct=True))
    }
    for group in groups:
        gid = group.id
        b_agg = batch_feedback_agg.get(gid, {"count": 0, "avg": None})
        b_enrolled = batch_enrolled.get(gid, 0)
        b_avg = round(float(b_agg["avg"]), 2) if b_agg["avg"] is not None else 0.0
        # response_rate as fraction (0.0–1.0) so frontend can multiply by 100 for display
        b_rate = round(b_agg["count"] / b_enrolled, 3) if b_enrolled else 0.0
        per_batch_avg.append({
            "batch_id": str(gid),
            "batch_name": group.name,
            "avg_rating": b_avg,
            "total_feedbacks": b_agg["count"],
            "response_rate": b_rate,
        })

    # --- Top / Bottom classes (min 1 feedback required to appear) ---
    class_agg = list(
        feedback_qs.values(
            "class_session_id",
            "class_session__title",
            "class_session__group__name",
        ).annotate(avg=Avg("rating"), cnt=Count("id"))
    )

    def _to_class_entry(row) -> dict:
        return {
            "class_id": str(row["class_session_id"]),
            "class_name": row["class_session__title"],
            "batch_name": row["class_session__group__name"],
            "avg_rating": round(float(row["avg"]), 2),
        }

    sorted_desc = sorted(class_agg, key=lambda r: (-float(r["avg"]), -r["cnt"]))
    sorted_asc = sorted(class_agg, key=lambda r: (float(r["avg"]), r["cnt"]))

    top_classes = [_to_class_entry(r) for r in sorted_desc[:5]]
    bottom_classes = [_to_class_entry(r) for r in sorted_asc[:5]]

    # --- Average rating over time (daily, based on submitted_at) ---
    from collections import OrderedDict  # noqa: PLC0415
    import datetime as _dt  # noqa: PLC0415

    daily_agg = {
        row["submitted_at__date"].isoformat(): round(float(row["avg"]), 2)
        for row in feedback_qs.values("submitted_at__date").annotate(avg=Avg("rating"))
        if row["submitted_at__date"] is not None
    }
    # Build a sorted list covering the date range in the filters (or last 30 days)
    if date_from and date_to:
        range_start = _dt.date.fromisoformat(date_from)
        range_end = _dt.date.fromisoformat(date_to)
    else:
        range_end = _dt.date.today()
        range_start = range_end - _dt.timedelta(days=29)

    avg_rating_over_time = []
    current = range_start
    while current <= range_end:
        iso = current.isoformat()
        if iso in daily_agg:
            avg_rating_over_time.append({"date": iso, "avg": daily_agg[iso]})
        current += _dt.timedelta(days=1)

    return {
        "overall_avg": average_rating if average_rating is not None else 0.0,
        "total_feedbacks": total_feedback,
        "rating_distribution": rating_distribution,
        "per_batch_avg": per_batch_avg,
        "top_classes": top_classes,
        "bottom_classes": bottom_classes,
        "avg_rating_over_time": avg_rating_over_time,
    }
