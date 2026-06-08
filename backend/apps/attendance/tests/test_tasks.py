"""Tests for B-08 Celery tasks.

Covers:
- heartbeat: updates SchedulerHealth.last_heartbeat_at
- open_due_tasks: flips is_open=True for tasks past upload_open_at
- open_due_tasks: skips tasks with future upload_open_at
- send_attendance_session_email: completes without exception (email to console backend)
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.common.models import SchedulerHealth
from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class
from apps.assignments.models import AssignmentTask

User = get_user_model()

NOW = timezone.now()
ONGOING_START = NOW - timedelta(hours=1)
ONGOING_END = NOW + timedelta(hours=1)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@tasks.test",
        password="pass",
        full_name="Admin Tasks",
        role="ADMIN",
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@tasks.test",
        password="pass",
        full_name="Part Tasks",
        role="PARTICIPANT",
    )


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(name="Tasks Batch", created_by=admin_user)


@pytest.fixture
def membership(db, participant_user, group):
    return GroupMembership.objects.create(user=participant_user, group=group)


@pytest.fixture
def ongoing_class(db, group, admin_user):
    return Class.objects.create(
        group=group,
        title="Ongoing Task Test Class",
        description="",
        starts_at=ONGOING_START,
        ends_at=ONGOING_END,
        created_by=admin_user,
    )


# ---------------------------------------------------------------------------
# heartbeat
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_heartbeat_updates_scheduler_health():
    """heartbeat() creates/updates SchedulerHealth row with a recent timestamp."""
    from apps.common.tasks import heartbeat

    before = timezone.now()
    result = heartbeat()
    after = timezone.now()

    assert result == "ok"
    health = SchedulerHealth.objects.get(pk=1)
    assert health.last_heartbeat_at is not None
    assert before <= health.last_heartbeat_at <= after


@pytest.mark.django_db
def test_heartbeat_is_idempotent():
    """Calling heartbeat() twice updates the same single row, not two rows."""
    from apps.common.tasks import heartbeat

    heartbeat()
    heartbeat()

    assert SchedulerHealth.objects.count() == 1
    health = SchedulerHealth.objects.get(pk=1)
    assert health.last_heartbeat_at is not None


# ---------------------------------------------------------------------------
# open_due_tasks
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_open_due_tasks_flips_is_open(db, group, admin_user):
    """Task whose upload_open_at is in the past and is_open=False gets flipped."""
    from apps.assignments.tasks import open_due_tasks

    task = AssignmentTask.objects.create(
        group=group,
        title="Past Open Task",
        question="What is 2+2?",
        upload_open_at=NOW - timedelta(minutes=5),
        deadline_at=NOW + timedelta(days=1),
        is_open=False,
        is_closed=False,
        created_by=admin_user,
    )

    count = open_due_tasks()

    assert count == 1
    task.refresh_from_db()
    assert task.is_open is True


@pytest.mark.django_db
def test_open_due_tasks_skips_future(db, group, admin_user):
    """Task whose upload_open_at is in the future stays is_open=False."""
    from apps.assignments.tasks import open_due_tasks

    task = AssignmentTask.objects.create(
        group=group,
        title="Future Open Task",
        question="What is 3+3?",
        upload_open_at=NOW + timedelta(hours=2),
        deadline_at=NOW + timedelta(days=2),
        is_open=False,
        is_closed=False,
        created_by=admin_user,
    )

    count = open_due_tasks()

    assert count == 0
    task.refresh_from_db()
    assert task.is_open is False


@pytest.mark.django_db
def test_open_due_tasks_skips_already_open(db, group, admin_user):
    """Task already is_open=True is not counted again."""
    from apps.assignments.tasks import open_due_tasks

    AssignmentTask.objects.create(
        group=group,
        title="Already Open Task",
        question="Already open?",
        upload_open_at=NOW - timedelta(hours=1),
        deadline_at=NOW + timedelta(days=1),
        is_open=True,
        is_closed=False,
        created_by=admin_user,
    )

    count = open_due_tasks()

    assert count == 0


@pytest.mark.django_db
def test_open_due_tasks_skips_closed(db, group, admin_user):
    """Task that is_closed=True is not flipped even if upload_open_at is past."""
    from apps.assignments.tasks import open_due_tasks

    task = AssignmentTask.objects.create(
        group=group,
        title="Closed Task",
        question="Closed already?",
        upload_open_at=NOW - timedelta(hours=1),
        deadline_at=NOW + timedelta(days=1),
        is_open=False,
        is_closed=True,
        created_by=admin_user,
    )

    count = open_due_tasks()

    assert count == 0
    task.refresh_from_db()
    assert task.is_open is False


# ---------------------------------------------------------------------------
# send_attendance_session_email (Celery task)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_send_attendance_session_email_task(ongoing_class, membership):
    """Task runs without exception; email goes to locmem backend in tests."""
    from apps.attendance.tasks import send_attendance_session_email
    from django.core import mail

    # CELERY_TASK_ALWAYS_EAGER=True in test settings → executes synchronously
    send_attendance_session_email(str(ongoing_class.id))

    # One email should have been sent (BCC to the participant)
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert ongoing_class.title in sent.subject


@pytest.mark.django_db
def test_send_attendance_session_email_no_members(ongoing_class):
    """Task with no group members completes without sending any email."""
    from apps.attendance.tasks import send_attendance_session_email
    from django.core import mail

    # No GroupMembership created → recipient_emails is empty → emails.py returns early
    send_attendance_session_email(str(ongoing_class.id))

    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_attendance_session_email_invalid_class_id():
    """Task raises on invalid class_id.

    With CELERY_TASK_ALWAYS_EAGER=True the broker is bypassed and
    self.retry() re-raises the original exception rather than scheduling a
    deferred retry.  We assert that the underlying cause (DoesNotExist) is
    surfaced — the important thing is that the task does not silently swallow
    the error.
    """
    from apps.attendance.tasks import send_attendance_session_email
    from apps.scheduling.models import Class

    with pytest.raises(Class.DoesNotExist):
        send_attendance_session_email("00000000-0000-0000-0000-000000000000")
