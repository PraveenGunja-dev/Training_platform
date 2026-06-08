from __future__ import annotations

from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Max, Prefetch
from django.utils import timezone


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
    classes_upcoming = Class.objects.filter(status_cached="UPCOMING", **_class_q).count()
    classes_completed = Class.objects.filter(status_cached="COMPLETED", **_class_q).count()
    submitted = Submission.objects.filter(status="SUBMITTED").count()
    late = Submission.objects.filter(status="LATE_SUBMITTED").count()
    pending_approvals = ParticipantSharedDoc.objects.filter(status="PENDING").count()
    video_uploads = Submission.objects.filter(file_type__startswith="video/").count()
    doc_uploads = Submission.objects.filter(file_type="application/pdf").count()
    pending = AssignmentTask.objects.filter(is_open=True, is_closed=False).count()

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
    groups = ClassGroup.objects.filter(is_archived=False, **_group_q)
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
        {"label": "Upcoming",  "value": Class.objects.filter(status_cached="UPCOMING", **_class_q).count()},
        {"label": "Ongoing",   "value": Class.objects.filter(status_cached="ONGOING", **_class_q).count()},
        {"label": "Completed", "value": Class.objects.filter(status_cached="COMPLETED", **_class_q).count()},
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

    # --- Participant activity (up to 100 rows) ---
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
        )[:100]
    )
    participant_ids = [p.id for p in participants]

    # Precompute user-level aggregates (3 queries)
    _attended_per_user = {
        row["user_id"]: row["cnt"]
        for row in AttendanceRecord.objects.filter(user_id__in=participant_ids)
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


def compute_instructor_payload(user) -> dict:
    """Dashboard payload scoped to the instructor's assigned groups."""
    from apps.assignments.models import AssignmentTask, Submission
    from apps.attendance.models import AttendanceRecord, AttendanceSession
    from apps.documents.models import ParticipantSharedDoc
    from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership
    from apps.scheduling.models import Class

    now = timezone.now()
    today = now.date()

    assigned_group_ids = list(
        GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    )
    groups = ClassGroup.objects.filter(pk__in=assigned_group_ids, is_archived=False)

    _class_q = {"group_id__in": assigned_group_ids}
    _group_q = {"pk__in": assigned_group_ids}

    total_participants = (
        GroupMembership.objects.filter(group_id__in=assigned_group_ids)
        .values("user_id").distinct().count()
    )
    total_groups = groups.count()
    classes_today = Class.objects.filter(starts_at__date=today, **_class_q).count()
    classes_upcoming = Class.objects.filter(status_cached="UPCOMING", **_class_q).count()
    classes_completed = Class.objects.filter(status_cached="COMPLETED", **_class_q).count()
    submitted = Submission.objects.filter(task__group_id__in=assigned_group_ids, status="SUBMITTED").count()
    late = Submission.objects.filter(task__group_id__in=assigned_group_ids, status="LATE_SUBMITTED").count()
    pending_approvals = ParticipantSharedDoc.objects.filter(
        group_id__in=assigned_group_ids, status="PENDING"
    ).count()
    pending = AssignmentTask.objects.filter(
        group_id__in=assigned_group_ids, is_open=True, is_closed=False
    ).count()

    # 14-day upload trend
    trend_days = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        count = Submission.objects.filter(
            task__group_id__in=assigned_group_ids, submitted_at__date=day
        ).count()
        trend_days.append({"date": day.isoformat(), "count": count})

    # Attendance pie (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    recent_sessions = AttendanceSession.objects.filter(
        class_obj__group_id__in=assigned_group_ids, started_at__gte=thirty_days_ago
    )
    present_count = AttendanceRecord.objects.filter(session__in=recent_sessions).count()
    attendance_pie = [
        {"label": "Present", "value": present_count},
        {"label": "Absent", "value": 0},
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
        {"label": "Upcoming",  "value": Class.objects.filter(status_cached="UPCOMING", **_class_q).count()},
        {"label": "Ongoing",   "value": Class.objects.filter(status_cached="ONGOING", **_class_q).count()},
        {"label": "Completed", "value": Class.objects.filter(status_cached="COMPLETED", **_class_q).count()},
        {"label": "Cancelled", "value": Class.objects.filter(status_cached="CANCELLED", **_class_q).count()},
    ]

    # --- Participant activity scoped to instructor's groups ---
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
        )[:100]
    )
    participant_ids = [p.id for p in participants]
    _attended_per_user = {
        row["user_id"]: row["cnt"]
        for row in AttendanceRecord.objects.filter(
            user_id__in=participant_ids,
            session__class_obj__group_id__in=assigned_group_ids,
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
            "video_uploads": 0,
            "doc_uploads": 0,
            "pending_approvals": pending_approvals,
        },
        "charts": {
            "attendance_pie": attendance_pie,
            "submission_bar": submission_bar,
            "group_comparison": [],
            "daily_upload_trend": trend_days,
            "deadline_tracking": deadline_tracking,
            "class_status": class_status,
            "weekly_trend": [],
        },
        "recent_documents": [],
        "recent_activity": [],
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
    attended = AttendanceRecord.objects.filter(user=user).count()
    attendance_rate = round((attended / total_sessions * 100) if total_sessions else 0)
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
