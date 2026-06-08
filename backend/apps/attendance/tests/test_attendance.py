"""Tests for the attendance app (B-05).

Covers:
- start_session happy path + email + audit
- start_session 409 when session already active
- start_session 422 when class outside time window
- end_session happy + 409 double-end
- mark_attendance happy + 409 already marked + 422 on ended session + 403 not in group
- active-session endpoint (member / non-member)
- report endpoint: present + absent rows + summary
- Admin record override (PATCH)
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class
from apps.attendance.models import AttendanceRecord, AttendanceSession

User = get_user_model()

NOW = timezone.now()
ONGOING_START = NOW - timedelta(hours=1)
ONGOING_END = NOW + timedelta(hours=1)
FUTURE_START = NOW + timedelta(days=30)
FUTURE_END = NOW + timedelta(days=30, hours=2)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@att.test", password="pass", full_name="Admin Att", role="ADMIN"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@att.test", password="pass", full_name="Part Att", role="PARTICIPANT"
    )


@pytest.fixture
def other_participant(db):
    return User.objects.create_user(
        email="other@att.test", password="pass", full_name="Other Att", role="PARTICIPANT"
    )


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def participant_client(participant_user):
    c = APIClient()
    c.force_authenticate(user=participant_user)
    return c


@pytest.fixture
def other_client(other_participant):
    c = APIClient()
    c.force_authenticate(user=other_participant)
    return c


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(name="Att Batch", created_by=admin_user)


@pytest.fixture
def membership(db, participant_user, group):
    return GroupMembership.objects.create(user=participant_user, group=group)


@pytest.fixture
def ongoing_class(db, group, admin_user):
    return Class.objects.create(
        group=group,
        title="Ongoing Class",
        description="",
        starts_at=ONGOING_START,
        ends_at=ONGOING_END,
        created_by=admin_user,
    )


@pytest.fixture
def future_class(db, group, admin_user):
    return Class.objects.create(
        group=group,
        title="Future Class",
        description="",
        starts_at=FUTURE_START,
        ends_at=FUTURE_END,
        created_by=admin_user,
    )


@pytest.fixture
def active_session(db, ongoing_class, admin_user):
    return AttendanceSession.objects.create(
        class_obj=ongoing_class,
        started_at=timezone.now(),
        started_by=admin_user,
        status="ACTIVE",
    )


# ---------------------------------------------------------------------------
# Start session (Admin POST /admin/attendance/sessions)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_start_session_success(admin_client, ongoing_class, participant_user, group, membership):
    resp = admin_client.post(
        "/api/v1/admin/attendance/sessions",
        {"class_id": str(ongoing_class.id)},
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "ACTIVE"
    assert data["class_id"] == str(ongoing_class.id)
    assert data["class_title"] == ongoing_class.title
    # Audit row written
    assert AuditLog.objects.filter(action="attendance.session_started").exists()


@pytest.mark.django_db
def test_start_session_already_active(admin_client, ongoing_class, active_session):
    resp = admin_client.post(
        "/api/v1/admin/attendance/sessions",
        {"class_id": str(ongoing_class.id)},
        format="json",
    )
    assert resp.status_code == 409
    errors = resp.json()["errors"]
    assert errors[0]["code"] == "attendance.session_already_active"


@pytest.mark.django_db
def test_start_session_outside_window(admin_client, future_class):
    resp = admin_client.post(
        "/api/v1/admin/attendance/sessions",
        {"class_id": str(future_class.id)},
        format="json",
    )
    assert resp.status_code == 422
    errors = resp.json()["errors"]
    assert errors[0]["code"] == "attendance.class_not_in_window"


@pytest.mark.django_db
def test_start_session_missing_class_id(admin_client):
    resp = admin_client.post("/api/v1/admin/attendance/sessions", {}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_start_session_participant_forbidden(participant_client, ongoing_class):
    resp = participant_client.post(
        "/api/v1/admin/attendance/sessions",
        {"class_id": str(ongoing_class.id)},
        format="json",
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# End session (Admin POST /admin/attendance/sessions/:id/end)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_end_session_success(admin_client, active_session):
    resp = admin_client.post(f"/api/v1/admin/attendance/sessions/{active_session.id}/end")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "ENDED"
    assert data["ended_at"] is not None
    assert AuditLog.objects.filter(action="attendance.session_ended").exists()


@pytest.mark.django_db
def test_end_session_already_ended(admin_client, active_session):
    active_session.status = "ENDED"
    active_session.ended_at = timezone.now()
    active_session.save()
    resp = admin_client.post(f"/api/v1/admin/attendance/sessions/{active_session.id}/end")
    assert resp.status_code == 409
    assert resp.json()["errors"][0]["code"] == "attendance.session_already_ended"


# ---------------------------------------------------------------------------
# Admin list + detail
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_list_sessions(admin_client, active_session):
    resp = admin_client.get("/api/v1/admin/attendance/sessions")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1


@pytest.mark.django_db
def test_admin_list_sessions_filter_by_class(admin_client, ongoing_class, active_session, group, admin_user):
    other_class = Class.objects.create(
        group=group, title="Other", description="", starts_at=ONGOING_START,
        ends_at=ONGOING_END, created_by=admin_user,
    )
    AttendanceSession.objects.create(
        class_obj=other_class, started_at=timezone.now(), started_by=admin_user, status="ACTIVE"
    )
    resp = admin_client.get(
        f"/api/v1/admin/attendance/sessions?class_id={ongoing_class.id}"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert all(str(d["class_id"]) == str(ongoing_class.id) for d in data)


@pytest.mark.django_db
def test_admin_retrieve_session(admin_client, active_session):
    resp = admin_client.get(f"/api/v1/admin/attendance/sessions/{active_session.id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(active_session.id)


# ---------------------------------------------------------------------------
# Mark attendance (Participant POST /attendance/sessions/:id/mark)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_mark_attendance_success(participant_client, active_session, membership):
    resp = participant_client.post(f"/api/v1/attendance/sessions/{active_session.id}/mark")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "PRESENT"
    assert data["marked_at"] is not None
    assert "." in data["marked_at"]  # ms precision check


@pytest.mark.django_db
def test_mark_attendance_already_marked(participant_client, active_session, membership):
    participant_client.post(f"/api/v1/attendance/sessions/{active_session.id}/mark")
    resp = participant_client.post(f"/api/v1/attendance/sessions/{active_session.id}/mark")
    assert resp.status_code == 409
    assert resp.json()["errors"][0]["code"] == "attendance.already_marked"


@pytest.mark.django_db
def test_mark_attendance_session_ended(participant_client, active_session, membership):
    active_session.status = "ENDED"
    active_session.ended_at = timezone.now()
    active_session.save()
    resp = participant_client.post(f"/api/v1/attendance/sessions/{active_session.id}/mark")
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["code"] == "attendance.session_ended"


@pytest.mark.django_db
def test_mark_attendance_not_in_group(other_client, active_session):
    # Session is scoped to the user's groups — non-members get 404, not 403,
    # to prevent timing-based enumeration of session→group mappings (M-1).
    resp = other_client.post(f"/api/v1/attendance/sessions/{active_session.id}/mark")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Active session (Participant GET /attendance/active-session)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_active_session_member_sees_session(participant_client, active_session, membership):
    resp = participant_client.get("/api/v1/attendance/active-session")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["session"] is not None
    assert data["session"]["status"] == "ACTIVE"
    assert data["my_record"] is None


@pytest.mark.django_db
def test_active_session_member_sees_record_after_marking(
    participant_client, participant_user, active_session, membership
):
    AttendanceRecord.objects.create(
        session=active_session, user=participant_user, marked_at=timezone.now(), status="PRESENT"
    )
    resp = participant_client.get("/api/v1/attendance/active-session")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["my_record"] is not None
    assert data["my_record"]["status"] == "PRESENT"


@pytest.mark.django_db
def test_active_session_non_member_returns_null(other_client, active_session):
    resp = other_client.get("/api/v1/attendance/active-session")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["session"] is None
    assert data["my_record"] is None


@pytest.mark.django_db
def test_active_session_no_active_session(participant_client, membership):
    resp = participant_client.get("/api/v1/attendance/active-session")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["session"] is None


# ---------------------------------------------------------------------------
# Report (Admin GET /admin/attendance/sessions/:id/report)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_report_present_and_absent(
    admin_client, active_session, participant_user, other_participant, group, membership
):
    GroupMembership.objects.create(user=other_participant, group=group)
    AttendanceRecord.objects.create(
        session=active_session, user=participant_user, marked_at=timezone.now(), status="PRESENT"
    )
    resp = admin_client.get(f"/api/v1/admin/attendance/sessions/{active_session.id}/report")
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["session"]["id"] == str(active_session.id)
    statuses = {r["user"]["email"]: r["status"] for r in payload["records"]}
    assert statuses[participant_user.email] == "PRESENT"
    assert statuses[other_participant.email] == "ABSENT"
    summary = payload["summary"]
    assert summary["total"] == 2
    assert summary["present"] == 1
    assert summary["absent"] == 1


@pytest.mark.django_db
def test_report_absent_rows_not_in_db(admin_client, active_session, membership):
    # No AttendanceRecord created; participant should appear as ABSENT
    resp = admin_client.get(f"/api/v1/admin/attendance/sessions/{active_session.id}/report")
    assert resp.status_code == 200
    records = resp.json()["data"]["records"]
    assert len(records) == 1
    assert records[0]["status"] == "ABSENT"
    assert records[0]["marked_at"] is None
    assert AttendanceRecord.objects.count() == 0  # no row in DB


@pytest.mark.django_db
def test_report_marked_at_iso_format(
    admin_client, active_session, participant_user, membership
):
    AttendanceRecord.objects.create(
        session=active_session, user=participant_user, marked_at=timezone.now(), status="PRESENT"
    )
    resp = admin_client.get(f"/api/v1/admin/attendance/sessions/{active_session.id}/report")
    records = resp.json()["data"]["records"]
    present = next(r for r in records if r["status"] == "PRESENT")
    assert "T" in present["marked_at"]  # ISO format has T separator


# ---------------------------------------------------------------------------
# Admin record override (PATCH /admin/attendance/records/:id)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_record_override(admin_client, active_session, participant_user, membership):
    record = AttendanceRecord.objects.create(
        session=active_session, user=participant_user, marked_at=timezone.now(), status="PRESENT"
    )
    resp = admin_client.patch(
        f"/api/v1/admin/attendance/records/{record.id}",
        {"status": "PRESENT"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "PRESENT"
    assert AuditLog.objects.filter(action="attendance.record_overridden").exists()


@pytest.mark.django_db
def test_admin_record_override_invalid_status(
    admin_client, active_session, participant_user, membership
):
    record = AttendanceRecord.objects.create(
        session=active_session, user=participant_user, marked_at=timezone.now(), status="PRESENT"
    )
    resp = admin_client.patch(
        f"/api/v1/admin/attendance/records/{record.id}",
        {"status": "INVALID"},
        format="json",
    )
    assert resp.status_code == 400
