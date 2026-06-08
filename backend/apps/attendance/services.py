from __future__ import annotations

import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

from apps.audit.services import log_action
from apps.groups.models import GroupMembership

from .models import AttendanceRecord, AttendanceSession
from .tasks import send_attendance_session_email


class AttendanceError(Exception):
    def __init__(self, code: str, message: str, http: int = 422) -> None:
        self.code = code
        self.message = message
        self.http = http
        super().__init__(message)


@transaction.atomic
def start_session(*, class_obj, actor, duration_minutes: int | None = None) -> AttendanceSession:
    if AttendanceSession.objects.filter(class_obj=class_obj, status="ACTIVE").exists():
        raise AttendanceError(
            "attendance.session_already_active",
            "A session is already active for this class",
            409,
        )
    now = timezone.now()
    scheduled_end_at = now + timedelta(minutes=duration_minutes) if duration_minutes else None
    try:
        session = AttendanceSession.objects.create(
            class_obj=class_obj,
            started_at=now,
            started_by=actor,
            status="ACTIVE",
            duration_minutes=duration_minutes,
            scheduled_end_at=scheduled_end_at,
        )
    except IntegrityError:
        # Race: another admin created a session between our check and insert
        raise AttendanceError(
            "attendance.session_already_active",
            "A session is already active for this class",
            409,
        )

    try:
        send_attendance_session_email.delay(str(class_obj.id))
    except Exception:
        logger.exception("Failed to enqueue session email for class %s", class_obj.id)
    # Skip countdown tasks in eager mode — they would execute immediately and
    # end the session before it is even visible to the caller.
    from django.conf import settings as _settings  # noqa: PLC0415
    if duration_minutes and not getattr(_settings, "CELERY_TASK_ALWAYS_EAGER", False):
        from .tasks import auto_end_attendance_session, attendance_closing_soon_warning  # noqa: PLC0415
        try:
            auto_end_attendance_session.apply_async(
                args=[str(session.id)],
                countdown=duration_minutes * 60,
            )
        except Exception:
            logger.exception("Failed to schedule auto_end task for session %s", session.id)
        if duration_minutes > 3:
            try:
                attendance_closing_soon_warning.apply_async(
                    args=[str(session.id)],
                    countdown=max((duration_minutes - 2) * 60, 60),
                )
            except Exception:
                logger.exception("Failed to schedule closing_soon_warning task for session %s", session.id)
    log_action(
        actor=actor,
        action="attendance.session_started",
        target_type="AttendanceSession",
        target_id=session.id,
        metadata={"class_id": str(class_obj.id)},
    )
    # Audit drift if session starts significantly before/after scheduled time
    if class_obj.starts_at:
        delta_minutes = (now - class_obj.starts_at).total_seconds() / 60
        from apps.common.models import SystemSettings  # noqa: PLC0415
        threshold = SystemSettings.get_solo().attendance_drift_threshold_minutes
        if abs(delta_minutes) > threshold:
            log_action(
                actor=actor,
                action="attendance.session_started_with_drift",
                target_type="AttendanceSession",
                target_id=session.id,
                metadata={
                    "delta_minutes": round(delta_minutes, 1),
                    "scheduled": class_obj.starts_at.isoformat(),
                    "actual": now.isoformat(),
                },
            )
    from apps.notifications.services import create_inapp
    for membership in GroupMembership.objects.filter(group=class_obj.group).select_related("user"):
        create_inapp(
            user=membership.user,
            type="ATTENDANCE_SESSION_STARTED",
            title=f"Attendance open: {class_obj.title}",
            body=f"Attendance is now open for {class_obj.title}. Please mark your attendance.",
            link=f"/me/classes/{class_obj.id}",
            dedupe_key=f"attendance_started:{session.id}:{membership.user_id}",
            payload={"session_id": str(session.id), "class_id": str(class_obj.id)},
        )
    return session


@transaction.atomic
def end_session(*, session: AttendanceSession, actor) -> AttendanceSession:
    if session.status != "ACTIVE":
        raise AttendanceError("attendance.session_already_ended", "Session already ended", 409)
    session.status = "ENDED"
    session.ended_at = timezone.now()
    session.ended_by = actor
    session.save(update_fields=["status", "ended_at", "ended_by"])
    log_action(
        actor=actor,
        action="attendance.session_ended",
        target_type="AttendanceSession",
        target_id=session.id,
        metadata={},
    )
    from apps.notifications.services import create_inapp
    for membership in GroupMembership.objects.filter(group=session.class_obj.group).select_related("user"):
        create_inapp(
            user=membership.user,
            type="ATTENDANCE_SESSION_ENDED",
            title=f"Attendance closed: {session.class_obj.title}",
            body=f"The attendance session for {session.class_obj.title} has ended.",
            link=f"/me/classes/{session.class_obj_id}",
            dedupe_key=f"attendance_ended:{session.id}:{membership.user_id}",
            payload={"session_id": str(session.id), "class_id": str(session.class_obj_id)},
        )
    return session


@transaction.atomic
def mark_attendance(*, session: AttendanceSession, user) -> AttendanceRecord:
    if session.status != "ACTIVE":
        raise AttendanceError("attendance.session_ended", "Session is no longer active", 422)
    if not GroupMembership.objects.filter(group=session.class_obj.group, user=user).exists():
        raise AttendanceError("perm.not_in_group", "You are not in this group", 403)
    record, created = AttendanceRecord.objects.get_or_create(
        session=session,
        user=user,
        defaults={"marked_at": timezone.now(), "status": "PRESENT"},
    )
    if not created:
        raise AttendanceError("attendance.already_marked", "Already marked", 409)
    return record


def maybe_end_expired_session(session: AttendanceSession) -> AttendanceSession:
    """End the session if its scheduled_end_at has passed. Used as a lazy fallback in dev."""
    if session.status != "ACTIVE":
        return session
    if session.scheduled_end_at and session.scheduled_end_at <= timezone.now():
        try:
            session = end_session(session=session, actor=session.started_by)
        except Exception:
            logger.exception("Failed to lazily end expired session %s", session.id)
    return session


def build_report(*, session: AttendanceSession) -> dict:
    memberships = (
        GroupMembership.objects.filter(group=session.class_obj.group)
        .select_related("user")
        .order_by("user__full_name")
    )
    records_by_user = {r.user_id: r for r in session.records.all()}
    rows = []
    present_count = 0
    for m in memberships:
        rec = records_by_user.get(m.user_id)
        if rec:
            rows.append({"user": m.user, "status": "PRESENT", "marked_at": rec.marked_at})
            present_count += 1
        else:
            rows.append({"user": m.user, "status": "ABSENT", "marked_at": None})
    return {
        "rows": rows,
        "summary": {
            "total": len(rows),
            "present": present_count,
            "absent": len(rows) - present_count,
        },
    }
