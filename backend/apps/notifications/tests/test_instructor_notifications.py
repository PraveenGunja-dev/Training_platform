"""
Chunk 09 — backend tests for instructor notification fan-out.

Covers:
 1. Assigning instructor fires GROUP_ASSIGNED; CO_INSTRUCTOR_ADDED to existing instructors; no self-notify.
 2. Unassigning fires GROUP_UNASSIGNED to the removed instructor.
 3. Class scheduled by Admin → instructors notified (CLASS_SCHEDULED_BY_ADMIN).
 4. Class scheduled by Instructor → other instructors notified, not actor.
 5. Submission received → with digest_submissions=False: immediate per-submission notification;
    with digest_submissions=True: same-day deduplication.
 6. Deadline approaching (24h window) → DEADLINE_APPROACHING fires; idempotent (won't double-fire).
 7. Session start drift > threshold → audit row created.
 8. Notification preferences PATCH persists.
 9. Email channel respects email_enabled=False.
10. Class rescheduled → CLASS_RESCHEDULED fires to instructors (not actor).
11. Class deleted → CLASS_CANCELLED fires to instructors.
12. Co-instructor content-only edit → CO_INSTRUCTOR_EDITED_CLASS fires to other instructors.
13. Assignment created by instructor → ASSIGNMENT_CREATED_IN_GROUP fires to co-instructors.
14. Attendance session reminder Celery task fires 30 min before class.
15. Participants added to group → PARTICIPANTS_ADDED_TO_GROUP fires to instructors.
16. Participants removed from group → PARTICIPANTS_REMOVED_FROM_GROUP fires to instructors.
17. Shared upload submitted by participant → SHARED_UPLOAD_PENDING fires to instructors.
"""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.services import notify_instructors
from apps.scheduling.models import Class

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email="admin9@n.test", password="pass", full_name="Admin9", role="ADMIN"
    )


@pytest.fixture
def instructor(db):
    return User.objects.create_user(
        email="ins9@n.test", password="pass", full_name="Ins9 One", role="INSTRUCTOR"
    )


@pytest.fixture
def instructor2(db):
    return User.objects.create_user(
        email="ins9b@n.test", password="pass", full_name="Ins9 Two", role="INSTRUCTOR"
    )


@pytest.fixture
def participant(db):
    return User.objects.create_user(
        email="part9@n.test", password="pass", full_name="Part9", role="PARTICIPANT"
    )


@pytest.fixture
def group(db, admin):
    return ClassGroup.objects.create(name="Group-9", description="", created_by=admin)


@pytest.fixture
def gi(db, group, instructor):
    """instructor is already assigned to group."""
    return GroupInstructor.objects.create(group=group, instructor=instructor, assigned_by=None)


@pytest.fixture
def class_obj(db, group, admin):
    from datetime import timedelta
    return Class.objects.create(
        title="TestClass9",
        group=group,
        starts_at=timezone.now() + timedelta(hours=2),
        ends_at=timezone.now() + timedelta(hours=3),
        created_by=admin,
    )


# ---------------------------------------------------------------------------
# Test 1 — GROUP_ASSIGNED + CO_INSTRUCTOR_ADDED
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_group_assigned_fires_on_assign(admin, instructor, group):
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.post(
        f"/api/v1/groups/{group.id}/instructors",
        {"user_ids": [str(instructor.id)]},
        format="json",
    )
    assert resp.status_code == 200
    assert Notification.objects.filter(user=instructor, type="GROUP_ASSIGNED").exists()


@pytest.mark.django_db
def test_co_instructor_added_fires_to_existing(admin, instructor, instructor2, group, gi):
    """Adding instructor2 should notify existing instructor (gi.instructor) with CO_INSTRUCTOR_ADDED."""
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.post(
        f"/api/v1/groups/{group.id}/instructors",
        {"user_ids": [str(instructor2.id)]},
        format="json",
    )
    assert resp.status_code == 200
    assert Notification.objects.filter(user=instructor, type="CO_INSTRUCTOR_ADDED").exists()


@pytest.mark.django_db
def test_no_self_notification_on_assign(admin, instructor, group):
    """Admin assigning an instructor should not produce a notification for the admin themselves."""
    client = APIClient()
    client.force_authenticate(admin)
    client.post(
        f"/api/v1/groups/{group.id}/instructors",
        {"user_ids": [str(instructor.id)]},
        format="json",
    )
    assert not Notification.objects.filter(user=admin, type="GROUP_ASSIGNED").exists()
    assert not Notification.objects.filter(user=admin, type="CO_INSTRUCTOR_ADDED").exists()


# ---------------------------------------------------------------------------
# Test 2 — GROUP_UNASSIGNED
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_group_unassigned_fires_on_remove(admin, instructor, group, gi):
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.delete(f"/api/v1/groups/{group.id}/instructors/{instructor.id}")
    assert resp.status_code == 204
    assert Notification.objects.filter(user=instructor, type="GROUP_UNASSIGNED").exists()


# ---------------------------------------------------------------------------
# Test 3 — CLASS_SCHEDULED_BY_ADMIN
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_class_scheduled_by_admin_notifies_instructors(admin, instructor, group, gi):
    from datetime import timedelta
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.post(
        "/api/v1/classes",
        {
            "title": "Sched by Admin",
            "group_id": str(group.id),
            "starts_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "ends_at": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Notification.objects.filter(user=instructor, type="CLASS_SCHEDULED_BY_ADMIN").exists()


# ---------------------------------------------------------------------------
# Test 4 — Instructor creates class → other instructors notified, actor not
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_class_created_by_instructor_notifies_co_instructors(instructor, instructor2, group, gi):
    from datetime import timedelta
    GroupInstructor.objects.create(group=group, instructor=instructor2, assigned_by=None)
    client = APIClient()
    client.force_authenticate(instructor)
    resp = client.post(
        "/api/v1/classes",
        {
            "title": "Sched by Instructor",
            "group_id": str(group.id),
            "starts_at": (timezone.now() + timedelta(days=2)).isoformat(),
            "ends_at": (timezone.now() + timedelta(days=2, hours=1)).isoformat(),
        },
        format="json",
    )
    assert resp.status_code == 201
    # instructor2 is notified
    assert Notification.objects.filter(user=instructor2, type="CLASS_SCHEDULED_BY_ADMIN").exists()
    # the actor (instructor) is NOT notified
    assert not Notification.objects.filter(user=instructor, type="CLASS_SCHEDULED_BY_ADMIN").exists()


# ---------------------------------------------------------------------------
# Test 5 — SUBMISSION_RECEIVED with/without digest
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submission_received_no_digest(admin, instructor, participant, group, gi, class_obj):
    from datetime import timedelta

    from apps.assignments.models import AssignmentTask
    GroupMembership.objects.create(group=group, user=participant)
    task = AssignmentTask.objects.create(
        title="Task9",
        group=group,
        created_by=admin,
        upload_open_at=timezone.now() - timedelta(minutes=1),
        deadline_at=timezone.now() + timedelta(days=7),
        is_open=True,
    )
    client = APIClient()
    client.force_authenticate(participant)
    resp = client.post(
        f"/api/v1/assignments/{task.id}/submissions",
        {
            "file_url": "submissions/test/file.pdf",
            "file_name": "file.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Notification.objects.filter(user=instructor, type="SUBMISSION_RECEIVED").exists()


@pytest.mark.django_db
def test_submission_received_digest_deduplicates_same_day(
    admin, instructor, participant, group, gi, class_obj
):
    from datetime import timedelta

    from apps.assignments.models import AssignmentTask

    GroupMembership.objects.create(group=group, user=participant)
    task = AssignmentTask.objects.create(
        title="DigestTask9",
        group=group,
        created_by=admin,
        upload_open_at=timezone.now() - timedelta(minutes=1),
        deadline_at=timezone.now() + timedelta(days=7),
        is_open=True,
    )
    # Enable digest for instructor
    NotificationPreference.objects.create(
        user=instructor, email_enabled=False, digest_submissions=True
    )
    today = timezone.now().strftime("%Y%m%d")
    # Pre-create the dedupe notification to simulate a prior same-day submission
    Notification.objects.create(
        user=instructor,
        type="SUBMISSION_RECEIVED",
        title="Submission received: DigestTask9",
        body="first",
        link=f"/instructor/assignments/{task.id}",
        dedupe_key=f"submission_received:{task.id}:{instructor.id}:{today}",
        sent_at=timezone.now(),
    )
    initial_count = Notification.objects.filter(
        user=instructor, type="SUBMISSION_RECEIVED"
    ).count()

    client = APIClient()
    client.force_authenticate(participant)
    resp = client.post(
        f"/api/v1/assignments/{task.id}/submissions",
        {
            "file_url": "submissions/test/file2.pdf",
            "file_name": "file2.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
        },
        format="json",
    )
    assert resp.status_code == 201
    # count should not increase (dedupe)
    assert Notification.objects.filter(user=instructor, type="SUBMISSION_RECEIVED").count() == initial_count


# ---------------------------------------------------------------------------
# Test 6 — DEADLINE_APPROACHING (cron task), idempotent
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_deadline_approaching_fires_and_is_idempotent(admin, instructor, group, gi):
    from datetime import timedelta

    from apps.assignments.models import AssignmentTask
    from apps.notifications.tasks import send_deadline_reminders

    AssignmentTask.objects.create(
        title="DeadlineTask9",
        group=group,
        created_by=admin,
        upload_open_at=timezone.now() - timedelta(minutes=1),
        deadline_at=timezone.now() + timedelta(hours=24),
        is_open=True,
    )
    count1 = send_deadline_reminders()
    assert count1 >= 1
    assert Notification.objects.filter(user=instructor, type="DEADLINE_APPROACHING").exists()

    # Second call — idempotent (same dedupe_key, same day)
    count2 = send_deadline_reminders()
    assert count2 == 0


# ---------------------------------------------------------------------------
# Test 7 — Session start drift > threshold creates audit entry
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_session_start_drift_audit_entry(admin, group, class_obj):
    from datetime import timedelta

    from apps.attendance.services import start_session
    from apps.common.models import SystemSettings

    # Set a low threshold so drift is easy to trigger
    settings = SystemSettings.get_solo()
    settings.attendance_drift_threshold_minutes = 5
    settings.save()

    # Make the class scheduled 2 hours ago (drift = 120 min > threshold 5)
    class_obj.starts_at = timezone.now() - timedelta(hours=2)
    class_obj.save()

    start_session(class_obj=class_obj, actor=admin)

    assert AuditLog.objects.filter(
        action="attendance.session_started_with_drift",
        target_id=str(class_obj.id),
    ).exists() is False  # target_id is session ID, not class ID

    # Session was created; check audit entry on the session
    from apps.attendance.models import AttendanceSession
    session = AttendanceSession.objects.get(class_obj=class_obj)
    assert AuditLog.objects.filter(
        action="attendance.session_started_with_drift",
        target_id=str(session.id),
    ).exists()


# ---------------------------------------------------------------------------
# Test 8 — Notification preferences PATCH persists
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_notification_preferences_patch(instructor):
    client = APIClient()
    client.force_authenticate(instructor)
    # GET should create defaults
    resp = client.get("/api/v1/me/notification-preferences")
    assert resp.status_code == 200
    assert resp.data["data"]["email_enabled"] is True
    assert resp.data["data"]["digest_submissions"] is False

    # PATCH to change email_enabled and digest_submissions
    resp2 = client.patch(
        "/api/v1/me/notification-preferences",
        {"email_enabled": False, "digest_submissions": True},
        format="json",
    )
    assert resp2.status_code == 200
    assert resp2.data["data"]["email_enabled"] is False
    assert resp2.data["data"]["digest_submissions"] is True

    # Verify persisted
    prefs = NotificationPreference.objects.get(user=instructor)
    assert prefs.email_enabled is False
    assert prefs.digest_submissions is True


# ---------------------------------------------------------------------------
# Test 9 — Email channel respects email_enabled=False
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_email_not_sent_when_disabled(instructor, group, gi, mailoutbox):
    """notify_instructors should not email a recipient who has email_enabled=False."""
    NotificationPreference.objects.create(
        user=instructor, email_enabled=False, digest_submissions=False
    )
    notify_instructors(
        group=group,
        notification_type="GROUP_ASSIGNED",
        title="Test",
        body="body",
        link="/instructor/groups",
        payload={},
        dedupe_suffix="email_test",
    )
    assert len(mailoutbox) == 0


# ---------------------------------------------------------------------------
# Test 10 — CLASS_RESCHEDULED
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_class_rescheduled_notifies_instructors(admin, instructor, instructor2, group, gi):
    """Rescheduling a class fires CLASS_RESCHEDULED to all instructors except the actor."""
    from datetime import timedelta
    GroupInstructor.objects.create(group=group, instructor=instructor2, assigned_by=None)
    cls = Class.objects.create(
        title="ReschedClass",
        group=group,
        starts_at=timezone.now() + timedelta(days=3),
        ends_at=timezone.now() + timedelta(days=3, hours=1),
        created_by=admin,
    )
    client = APIClient()
    client.force_authenticate(admin)
    new_start = (timezone.now() + timedelta(days=4)).isoformat()
    new_end = (timezone.now() + timedelta(days=4, hours=1)).isoformat()
    resp = client.patch(
        f"/api/v1/classes/{cls.id}",
        {"starts_at": new_start, "ends_at": new_end},
        format="json",
    )
    assert resp.status_code == 200
    # Both instructors notified (actor is admin, not an instructor)
    assert Notification.objects.filter(user=instructor, type="CLASS_RESCHEDULED").exists()
    assert Notification.objects.filter(user=instructor2, type="CLASS_RESCHEDULED").exists()


# ---------------------------------------------------------------------------
# Test 11 — CLASS_CANCELLED
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_class_cancelled_notifies_instructors(admin, instructor, instructor2, group, gi):
    """Deleting a class fires CLASS_CANCELLED to all instructors except the actor."""
    from datetime import timedelta
    GroupInstructor.objects.create(group=group, instructor=instructor2, assigned_by=None)
    cls = Class.objects.create(
        title="CancelClass",
        group=group,
        starts_at=timezone.now() + timedelta(days=5),
        ends_at=timezone.now() + timedelta(days=5, hours=1),
        created_by=admin,
    )
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.delete(f"/api/v1/classes/{cls.id}")
    assert resp.status_code == 204
    assert Notification.objects.filter(user=instructor, type="CLASS_CANCELLED").exists()
    assert Notification.objects.filter(user=instructor2, type="CLASS_CANCELLED").exists()
    # Admin (actor) should NOT receive it
    assert not Notification.objects.filter(user=admin, type="CLASS_CANCELLED").exists()


# ---------------------------------------------------------------------------
# Test 12 — CO_INSTRUCTOR_EDITED_CLASS
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_co_instructor_edit_notifies_other_instructors(instructor, instructor2, group, gi):
    """Content-only edit by an instructor fires CO_INSTRUCTOR_EDITED_CLASS to co-instructors."""
    from datetime import timedelta
    GroupInstructor.objects.create(group=group, instructor=instructor2, assigned_by=None)
    cls = Class.objects.create(
        title="EditClass",
        group=group,
        starts_at=timezone.now() + timedelta(days=6),
        ends_at=timezone.now() + timedelta(days=6, hours=1),
        created_by=instructor,
    )
    client = APIClient()
    client.force_authenticate(instructor)
    resp = client.patch(
        f"/api/v1/classes/{cls.id}",
        {"title": "EditClass Updated"},
        format="json",
    )
    assert resp.status_code == 200
    # co-instructor notified
    assert Notification.objects.filter(user=instructor2, type="CO_INSTRUCTOR_EDITED_CLASS").exists()
    # actor NOT notified
    assert not Notification.objects.filter(user=instructor, type="CO_INSTRUCTOR_EDITED_CLASS").exists()


# ---------------------------------------------------------------------------
# Test 13 — ASSIGNMENT_CREATED_IN_GROUP
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_assignment_created_notifies_co_instructors(instructor, instructor2, group, gi):
    """Creating an assignment fires ASSIGNMENT_CREATED_IN_GROUP to co-instructors, not the creator."""
    from datetime import timedelta
    GroupInstructor.objects.create(group=group, instructor=instructor2, assigned_by=None)
    client = APIClient()
    client.force_authenticate(instructor)
    resp = client.post(
        "/api/v1/assignments",
        {
            "title": "NewAssign",
            "question": "What is it?",
            "group_id": str(group.id),
            "upload_open_at": (timezone.now() - timedelta(minutes=1)).isoformat(),
            "deadline_at": (timezone.now() + timedelta(days=7)).isoformat(),
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Notification.objects.filter(user=instructor2, type="ASSIGNMENT_CREATED_IN_GROUP").exists()
    assert not Notification.objects.filter(user=instructor, type="ASSIGNMENT_CREATED_IN_GROUP").exists()


# ---------------------------------------------------------------------------
# Test 14 — ATTENDANCE_SESSION_REMINDER (Celery task)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_attendance_session_reminder_fires_30_min_before(admin, instructor, group, gi):
    """send_attendance_session_reminders fires ATTENDANCE_SESSION_REMINDER for classes starting in ~30 min."""
    from datetime import timedelta
    from apps.notifications.tasks import send_attendance_session_reminders

    cls = Class.objects.create(
        title="ReminderClass",
        group=group,
        starts_at=timezone.now() + timedelta(minutes=30),
        ends_at=timezone.now() + timedelta(minutes=90),
        created_by=admin,
        status_cached="UPCOMING",
    )
    count = send_attendance_session_reminders()
    assert count >= 1
    assert Notification.objects.filter(
        user=instructor,
        type="ATTENDANCE_SESSION_REMINDER",
    ).exists()

    # Idempotent — second call within the same minute does not duplicate
    count2 = send_attendance_session_reminders()
    assert count2 == 0
    assert Notification.objects.filter(user=instructor, type="ATTENDANCE_SESSION_REMINDER").count() == 1

    cls.delete()


# ---------------------------------------------------------------------------
# Test 15 — PARTICIPANTS_ADDED_TO_GROUP
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_participants_added_notifies_instructors(admin, instructor, participant, group, gi):
    """Admin adding participants to a group fires PARTICIPANTS_ADDED_TO_GROUP to assigned instructors."""
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.post(
        f"/api/v1/groups/{group.id}/participants",
        {"user_ids": [str(participant.id)]},
        format="json",
    )
    assert resp.status_code == 200
    assert Notification.objects.filter(
        user=instructor, type="PARTICIPANTS_ADDED_TO_GROUP"
    ).exists()
    # Admin (actor) should NOT be notified
    assert not Notification.objects.filter(user=admin, type="PARTICIPANTS_ADDED_TO_GROUP").exists()


# ---------------------------------------------------------------------------
# Test 16 — PARTICIPANTS_REMOVED_FROM_GROUP
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_participants_removed_notifies_instructors(admin, instructor, participant, group, gi):
    """Removing a participant fires PARTICIPANTS_REMOVED_FROM_GROUP to assigned instructors."""
    from apps.groups.models import GroupMembership
    GroupMembership.objects.create(group=group, user=participant)
    client = APIClient()
    client.force_authenticate(admin)
    resp = client.delete(f"/api/v1/groups/{group.id}/participants/{participant.id}")
    assert resp.status_code in (200, 204)
    assert Notification.objects.filter(
        user=instructor, type="PARTICIPANTS_REMOVED_FROM_GROUP"
    ).exists()


# ---------------------------------------------------------------------------
# Test 17 — SHARED_UPLOAD_PENDING
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_shared_upload_pending_notifies_instructors(admin, instructor, participant, group, gi):
    """Participant submitting a shared upload fires SHARED_UPLOAD_PENDING to group instructors."""
    from apps.documents.models import ParticipantUploadPermission
    from apps.groups.models import GroupMembership
    GroupMembership.objects.create(group=group, user=participant)
    ParticipantUploadPermission.objects.create(
        user=participant, group=group, granted_by=admin
    )
    client = APIClient()
    client.force_authenticate(participant)
    resp = client.post(
        f"/api/v1/groups/{group.id}/shared-uploads",
        {
            "title": "My Report",
            "file_url": "mock://shared/report.pdf",
            "file_name": "report.pdf",
            "file_type": "application/pdf",
            "file_size": 2048,
            "suggested_visibility": "GROUP",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Notification.objects.filter(
        user=instructor, type="SHARED_UPLOAD_PENDING"
    ).exists()
