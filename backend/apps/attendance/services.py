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

# Sessions shorter than or equal to this threshold get no closing-soon warning
# (not enough lead time between the warning firing and the session ending)
_CLOSING_SOON_MIN_DURATION_MINUTES = 3


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
        send_attendance_session_email.delay(str(class_obj.id), str(session.id))
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
        if duration_minutes > _CLOSING_SOON_MIN_DURATION_MINUTES:
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

    def _notify_session_started(session_id=str(session.id), class_id=str(class_obj.id), class_title=class_obj.title, group_id=session.class_obj.group_id):
        from apps.notifications.services import create_inapp
        for membership in GroupMembership.objects.filter(group_id=group_id).select_related("user"):
            create_inapp(
                user=membership.user,
                type="ATTENDANCE_SESSION_STARTED",
                title=f"Attendance open: {class_title}",
                body=f"Attendance is now open for {class_title}. Please mark your attendance.",
                link=f"/me/classes/{class_id}",
                dedupe_key=f"attendance_started:{session_id}:{membership.user_id}",
                payload={"session_id": session_id, "class_id": class_id},
            )

    transaction.on_commit(_notify_session_started)
    return session


@transaction.atomic
def end_session(*, session: AttendanceSession, actor, is_auto: bool = False) -> AttendanceSession:
    if session.status != "ACTIVE":
        raise AttendanceError("attendance.session_already_ended", "Session already ended", 409)
    session.status = "ENDED"
    session.ended_at = timezone.now()
    session.ended_by = actor if not is_auto else None
    session.save(update_fields=["status", "ended_at", "ended_by"])
    log_action(
        actor=actor,
        action="attendance.session_auto_ended" if is_auto else "attendance.session_ended",
        target_type="AttendanceSession",
        target_id=session.id,
        metadata={
            "class_id": str(session.class_obj_id),
            **({"auto_ended": True} if is_auto else {}),
        },
    )

    def _notify_session_ended(session_id=str(session.id), class_id=str(session.class_obj_id), class_title=session.class_obj.title, group_id=session.class_obj.group_id):
        from apps.notifications.services import create_inapp
        for membership in GroupMembership.objects.filter(group_id=group_id).select_related("user"):
            create_inapp(
                user=membership.user,
                type="ATTENDANCE_SESSION_ENDED",
                title=f"Attendance closed: {class_title}",
                body=f"The attendance session for {class_title} has ended.",
                link=f"/me/classes/{class_id}",
                dedupe_key=f"attendance_ended:{session_id}:{membership.user_id}",
                payload={"session_id": session_id, "class_id": class_id},
            )

    transaction.on_commit(_notify_session_ended)
    return session


@transaction.atomic
def mark_attendance(*, session: AttendanceSession, user) -> AttendanceRecord:
    session = AttendanceSession.objects.select_for_update().get(pk=session.pk)
    if session.status != "ACTIVE":
        raise AttendanceError("attendance.session_ended", "Session is no longer active", 422)
    if not GroupMembership.objects.filter(group=session.class_obj.group, user=user).exists():
        raise AttendanceError("perm.not_in_group", "You are not in this group", 403)
    if session.class_obj.sub_group_id:
        from apps.groups.models import SubGroupMembership
        if not SubGroupMembership.objects.filter(
            sub_group_id=session.class_obj.sub_group_id, user=user
        ).exists():
            raise AttendanceError(
                "perm.not_in_sub_group",
                "You are not in the sub-group scheduled for this class",
                403,
            )
    record, created = AttendanceRecord.objects.get_or_create(
        session=session,
        user=user,
        defaults={"marked_at": timezone.now(), "status": "PRESENT"},
    )
    if not created:
        raise AttendanceError("attendance.already_marked", "Already marked", 409)
    log_action(
        actor=user,
        action="attendance.self_marked",
        target_type="AttendanceSession",
        target_id=session.id,
        metadata={"user_id": str(user.id), "record_id": str(record.id)},
    )
    return record


def maybe_end_expired_session(session: AttendanceSession) -> AttendanceSession:
    """End the session if its scheduled_end_at has passed. Used as a lazy fallback in dev."""
    if session.status != "ACTIVE":
        return session
    if session.scheduled_end_at and session.scheduled_end_at <= timezone.now():
        try:
            session = end_session(session=session, actor=session.started_by, is_auto=True)
        except Exception:
            logger.exception("Failed to lazily end expired session %s", session.id)
    return session


def build_report(*, session: AttendanceSession) -> dict:
    records_qs = session.records.select_related("user").order_by()
    records_by_user_id = {r.user_id: r for r in records_qs if r.user_id}

    current_memberships = (
        GroupMembership.objects.filter(group=session.class_obj.group)
        .select_related("user")
        .order_by("user__full_name")
    )

    rows = []
    present_count = 0
    processed_ids: set = set()

    for m in current_memberships:
        rec = records_by_user_id.get(m.user_id)
        row_status = rec.status if rec else "ABSENT"
        rows.append({"user": m.user, "status": row_status, "marked_at": rec.marked_at if rec else None})
        if row_status == "PRESENT":
            present_count += 1
        processed_ids.add(m.user_id)

    for user_id, rec in records_by_user_id.items():
        if user_id in processed_ids or not rec.user:
            continue
        rows.append({"user": rec.user, "status": rec.status, "marked_at": rec.marked_at})
        if rec.status == "PRESENT":
            present_count += 1

    return {
        "rows": rows,
        "summary": {
            "total": len(rows),
            "present": present_count,
            "absent": len(rows) - present_count,
        },
    }
