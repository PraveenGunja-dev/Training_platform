"""Chunk 02 — Sub-Mentor scoping tests for the attendance app."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.groups.models import ClassGroup, GroupSubMentor, GroupMembership
from apps.scheduling.models import Class

User = get_user_model()

NOW = timezone.now()
FUTURE_START = NOW + timedelta(hours=2)
FUTURE_END = NOW + timedelta(hours=4)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin@att.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def sub_mentor(db):
    return User.objects.create_user(email="ins@att.s.test", password="pass", full_name="Sub-Mentor", role="SUB_MENTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@att.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def sub_mentor_client(sub_mentor):
    c = APIClient()
    c.force_authenticate(user=sub_mentor)
    return c


@pytest.fixture
def participant_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def group_a(db, admin):
    return ClassGroup.objects.create(name="Att Group A", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Att Group B", created_by=admin)


@pytest.fixture
def assigned(group_a, sub_mentor, admin):
    return GroupSubMentor.objects.create(group=group_a, sub_mentor=sub_mentor, assigned_by=admin)


@pytest.fixture
def class_a(db, group_a, admin):
    return Class.objects.create(
        group=group_a, title="Class A", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin
    )


@pytest.fixture
def class_b(db, group_b, admin):
    return Class.objects.create(
        group=group_b, title="Class B", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin
    )


@pytest.fixture
def session_a(db, class_a, admin):
    return AttendanceSession.objects.create(
        class_obj=class_a, started_by=admin, started_at=NOW, status="ACTIVE"
    )


@pytest.fixture
def session_b(db, class_b, admin):
    return AttendanceSession.objects.create(
        class_obj=class_b, started_by=admin, started_at=NOW, status="ACTIVE"
    )


# ---------------------------------------------------------------------------
# List sessions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSessionList:
    def test_admin_sees_all_sessions(self, admin_client, session_a, session_b):
        resp = admin_client.get("/training/api/v1/admin/attendance/sessions")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) >= 2

    def test_sub_mentor_no_assignment_sees_empty(self, sub_mentor_client, session_a):
        resp = sub_mentor_client.get("/training/api/v1/admin/attendance/sessions")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_sub_mentor_assigned_sees_only_own_sessions(self, sub_mentor_client, assigned, session_a, session_b):
        resp = sub_mentor_client.get("/training/api/v1/admin/attendance/sessions")
        assert resp.status_code == 200
        data = resp.json()["data"]
        ids = {r["id"] for r in data}
        assert str(session_a.id) in ids
        assert str(session_b.id) not in ids

    def test_participant_cannot_access_admin_sessions(self, participant_client):
        resp = participant_client.get("/training/api/v1/admin/attendance/sessions")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Create session
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSessionCreate:
    def test_sub_mentor_can_start_session_on_assigned_class(self, sub_mentor_client, assigned, class_a):
        resp = sub_mentor_client.post(
            "/training/api/v1/admin/attendance/sessions",
            {"class_id": str(class_a.id)},
            format="json",
        )
        assert resp.status_code == 201

    def test_sub_mentor_cannot_start_session_on_unassigned_class(self, sub_mentor_client, class_b):
        resp = sub_mentor_client.post(
            "/training/api/v1/admin/attendance/sessions",
            {"class_id": str(class_b.id)},
            format="json",
        )
        assert resp.status_code == 403

    def test_participant_cannot_start_session(self, participant_client, class_a):
        resp = participant_client.post(
            "/training/api/v1/admin/attendance/sessions",
            {"class_id": str(class_a.id)},
            format="json",
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Retrieve session
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSessionRetrieve:
    def test_sub_mentor_retrieves_assigned_session(self, sub_mentor_client, assigned, session_a):
        resp = sub_mentor_client.get(f"/training/api/v1/admin/attendance/sessions/{session_a.id}")
        assert resp.status_code == 200

    def test_sub_mentor_cannot_retrieve_unassigned_session(self, sub_mentor_client, session_b):
        resp = sub_mentor_client.get(f"/training/api/v1/admin/attendance/sessions/{session_b.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# End session
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSessionEnd:
    def test_sub_mentor_can_end_assigned_session(self, sub_mentor_client, assigned, session_a):
        resp = sub_mentor_client.post(f"/training/api/v1/admin/attendance/sessions/{session_a.id}/end")
        assert resp.status_code == 200

    def test_sub_mentor_cannot_end_unassigned_session(self, sub_mentor_client, session_b):
        resp = sub_mentor_client.post(f"/training/api/v1/admin/attendance/sessions/{session_b.id}/end")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSessionReport:
    def test_sub_mentor_can_view_report_on_assigned_session(self, sub_mentor_client, assigned, session_a):
        resp = sub_mentor_client.get(f"/training/api/v1/admin/attendance/sessions/{session_a.id}/report")
        assert resp.status_code == 200

    def test_sub_mentor_cannot_view_report_on_unassigned_session(self, sub_mentor_client, session_b):
        resp = sub_mentor_client.get(f"/training/api/v1/admin/attendance/sessions/{session_b.id}/report")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Record override
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRecordOverride:
    def test_sub_mentor_can_override_record_in_assigned_group(self, sub_mentor_client, assigned, session_a, participant):
        record = AttendanceRecord.objects.create(
            session=session_a, user=participant, status="PRESENT", marked_at=NOW
        )
        resp = sub_mentor_client.patch(
            f"/training/api/v1/admin/attendance/records/{record.id}",
            {"status": "ABSENT"},
            format="json",
        )
        assert resp.status_code == 200

    def test_sub_mentor_cannot_override_record_in_unassigned_group(
        self, sub_mentor_client, session_b, participant
    ):
        record = AttendanceRecord.objects.create(
            session=session_b, user=participant, status="PRESENT", marked_at=NOW
        )
        resp = sub_mentor_client.patch(
            f"/training/api/v1/admin/attendance/records/{record.id}",
            {"status": "ABSENT"},
            format="json",
        )
        assert resp.status_code == 403
