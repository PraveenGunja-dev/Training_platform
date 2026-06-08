from __future__ import annotations

from celery import shared_task


@shared_task(
    name="apps.attendance.tasks.send_attendance_session_email",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_attendance_session_email(self, class_id: str) -> None:
    from celery.exceptions import Retry

    try:
        from apps.scheduling.models import Class
        from apps.groups.models import GroupMembership
        from .emails import send_session_started_email

        cls = Class.objects.get(id=class_id)
        recipient_emails = list(
            GroupMembership.objects.filter(group=cls.group)
            .values_list("user__email", flat=True)
        )
        send_session_started_email(class_obj=cls, recipient_emails=recipient_emails)
    except Retry:
        raise
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(name="apps.attendance.tasks.attendance_closing_soon_warning")
def attendance_closing_soon_warning(session_id: str) -> None:
    """Fires ~2 minutes before a timed session ends. Notifies participants who haven't marked."""
    from apps.attendance.models import AttendanceSession, AttendanceRecord
    from apps.groups.models import GroupMembership
    from apps.notifications.models import Notification
    from django.utils import timezone as tz

    try:
        session = AttendanceSession.objects.select_related("class_obj__group").get(id=session_id)
    except AttendanceSession.DoesNotExist:
        return

    if session.status != "ACTIVE":
        return

    marked_user_ids = set(
        AttendanceRecord.objects.filter(session=session).values_list("user_id", flat=True)
    )
    all_member_ids = list(
        GroupMembership.objects.filter(group=session.class_obj.group)
        .values_list("user_id", flat=True)
    )
    # Only notify members who haven't marked yet
    unmarked_ids = [uid for uid in all_member_ids if uid not in marked_user_ids]
    if not unmarked_ids:
        return

    now = tz.now()
    cls = session.class_obj
    Notification.objects.bulk_create(
        [
            Notification(
                user_id=uid,
                type="ATTENDANCE_CLOSING_SOON",
                title=f"Attendance closing soon: {cls.title}",
                body=f"Attendance for {cls.title} closes in 2 minutes. Mark your attendance now!",
                link=f"/me/classes/{cls.id}",
                dedupe_key=f"attendance_closing_soon:{session.id}:{uid}",
                sent_at=now,
                payload={"session_id": str(session.id), "class_id": str(cls.id)},
            )
            for uid in unmarked_ids
        ],
        ignore_conflicts=True,
    )


@shared_task(
    name="apps.attendance.tasks.auto_end_attendance_session",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def auto_end_attendance_session(self, session_id: str) -> None:
    from celery.exceptions import Retry

    try:
        from .models import AttendanceSession
        from .services import end_session, AttendanceError

        try:
            session = AttendanceSession.objects.select_related(
                "class_obj__group", "started_by", "ended_by"
            ).get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return

        if session.status != "ACTIVE":
            return

        end_session(session=session, actor=session.started_by)
    except Retry:
        raise
    except Exception as exc:
        raise self.retry(exc=exc)
