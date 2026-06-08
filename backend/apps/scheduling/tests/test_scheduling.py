"""Tests for the scheduling app (B-04 + B-11).

Covers:
- Class CRUD (admin)
- Participant scoping
- status_cached recomputation
- /me/calendar endpoint
- Attendance window fields (B-11): model, serializer, validation
- Audit log on write actions
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

User = get_user_model()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NOW = timezone.now()
FUTURE_START = NOW + timedelta(hours=2)
FUTURE_END = NOW + timedelta(hours=4)
PAST_START = NOW - timedelta(hours=4)
PAST_END = NOW - timedelta(hours=2)
ONGOING_START = NOW - timedelta(minutes=30)
ONGOING_END = NOW + timedelta(minutes=30)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@sched.test", password="pass", full_name="Admin Sched", role="ADMIN"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@sched.test", password="pass", full_name="Participant Sched", role="PARTICIPANT"
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
def group(db, admin_user):
    return ClassGroup.objects.create(name="Test Batch", created_by=admin_user)


@pytest.fixture
def other_group(db, admin_user):
    return ClassGroup.objects.create(name="Other Batch", created_by=admin_user)


@pytest.fixture
def upcoming_class(db, group, admin_user):
    return Class.objects.create(
        group=group,
        title="Upcoming Class",
        starts_at=FUTURE_START,
        ends_at=FUTURE_END,
        created_by=admin_user,
    )


@pytest.fixture
def past_class(db, group, admin_user):
    return Class.objects.create(
        group=group,
        title="Past Class",
        starts_at=PAST_START,
        ends_at=PAST_END,
        created_by=admin_user,
    )


# ---------------------------------------------------------------------------
# B-11 — attendance window fields present in model
# ---------------------------------------------------------------------------


def test_class_model_has_attendance_window_fields():
    field_names = {f.name for f in Class._meta.get_fields()}
    assert "attendance_open_at" in field_names
    assert "attendance_close_at" in field_names
    assert "allow_late_attendance" in field_names


def test_initial_migration_has_no_attendance_window_fields():
    """0001_initial must NOT contain these fields — they live in the gap migration."""
    import importlib

    migration_module = importlib.import_module("apps.scheduling.migrations.0001_initial")
    for op in migration_module.Migration.operations:
        field_names = [f[0] for f in op.fields]
        for absent in ("attendance_open_at", "attendance_close_at", "allow_late_attendance"):
            assert absent not in field_names


# ---------------------------------------------------------------------------
# Class model — computed_status
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestComputedStatus:
    def test_upcoming_when_future(self, group, admin_user):
        cls = Class.objects.create(
            group=group, title="T", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user
        )
        assert cls.status_cached == Class.STATUS_UPCOMING

    def test_ongoing_when_now_in_window(self, group, admin_user):
        cls = Class.objects.create(
            group=group, title="T", starts_at=ONGOING_START, ends_at=ONGOING_END, created_by=admin_user
        )
        assert cls.status_cached == Class.STATUS_ONGOING

    def test_completed_when_past(self, group, admin_user):
        cls = Class.objects.create(
            group=group, title="T", starts_at=PAST_START, ends_at=PAST_END, created_by=admin_user
        )
        assert cls.status_cached == Class.STATUS_COMPLETED

    def test_cancelled_preserved_on_save(self, group, admin_user):
        cls = Class.objects.create(
            group=group, title="T", starts_at=FUTURE_START, ends_at=FUTURE_END,
            status_cached=Class.STATUS_CANCELLED, created_by=admin_user,
        )
        # Force save without changing status
        cls.save()
        cls.refresh_from_db()
        assert cls.status_cached == Class.STATUS_CANCELLED

    def test_status_recomputes_when_starts_at_moves_to_past(self, group, admin_user):
        cls = Class.objects.create(
            group=group, title="T", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user
        )
        assert cls.status_cached == Class.STATUS_UPCOMING
        cls.starts_at = PAST_START
        cls.ends_at = PAST_END
        cls.save()
        assert cls.status_cached == Class.STATUS_COMPLETED


# ---------------------------------------------------------------------------
# Admin CRUD
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAdminCRUD:
    def test_admin_can_create_class(self, admin_client, group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "New Class",
                "description": "A description",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["title"] == "New Class"
        assert data["group_id"] == str(group.id)
        assert data["group_name"] == group.name
        assert data["status"] == "UPCOMING"
        assert "active_session" in data
        assert data["active_session"] is None
        assert "my_record" in data

    def test_admin_list_returns_all_classes(self, admin_client, upcoming_class, past_class):
        resp = admin_client.get("/api/v1/classes")
        assert resp.status_code == 200
        titles = [c["title"] for c in resp.json()["data"]]
        assert "Upcoming Class" in titles
        assert "Past Class" in titles

    def test_admin_retrieve_class_detail(self, admin_client, upcoming_class):
        resp = admin_client.get(f"/api/v1/classes/{upcoming_class.id}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == str(upcoming_class.id)
        assert "active_session" in data
        assert "my_record" in data
        assert "group_id" in data
        assert "group_name" in data
        assert "created_by_name" in data

    def test_admin_patch_class_title(self, admin_client, upcoming_class):
        resp = admin_client.patch(
            f"/api/v1/classes/{upcoming_class.id}",
            {"title": "Renamed Class"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Renamed Class"

    def test_admin_patch_status_to_cancelled(self, admin_client, upcoming_class):
        resp = admin_client.patch(
            f"/api/v1/classes/{upcoming_class.id}",
            {"status": "CANCELLED"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "CANCELLED"

    def test_admin_delete_class(self, admin_client, upcoming_class):
        resp = admin_client.delete(f"/api/v1/classes/{upcoming_class.id}")
        assert resp.status_code == 204
        assert not Class.objects.filter(pk=upcoming_class.pk).exists()

    def test_create_writes_audit(self, admin_client, group):
        admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "Audit Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert AuditLog.objects.filter(action="class.created").exists()

    def test_patch_writes_audit(self, admin_client, upcoming_class):
        admin_client.patch(
            f"/api/v1/classes/{upcoming_class.id}",
            {"title": "Patched"},
            format="json",
        )
        assert AuditLog.objects.filter(action="class.updated").exists()

    def test_delete_writes_audit(self, admin_client, upcoming_class):
        admin_client.delete(f"/api/v1/classes/{upcoming_class.id}")
        assert AuditLog.objects.filter(action="class.deleted").exists()

    def test_retrieve_nonexistent_returns_404(self, admin_client):
        resp = admin_client.get(f"/api/v1/classes/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Filters on list endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListFilters:
    def test_filter_by_group_id(self, admin_client, group, other_group, admin_user):
        c1 = Class.objects.create(group=group, title="G1", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)
        Class.objects.create(group=other_group, title="G2", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)
        resp = admin_client.get(f"/api/v1/classes?group_id={group.id}")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["data"]]
        assert str(c1.id) in ids
        for c in resp.json()["data"]:
            assert c["group_id"] == str(group.id)

    def test_filter_by_status(self, admin_client, upcoming_class, past_class):
        resp = admin_client.get("/api/v1/classes?status=UPCOMING")
        assert resp.status_code == 200
        statuses = [c["status"] for c in resp.json()["data"]]
        assert all(s == "UPCOMING" for s in statuses)

    def test_filter_from_date(self, admin_client, upcoming_class, past_class):
        # Pass datetime via data= dict so DRF test client handles URL encoding safely
        resp = admin_client.get("/api/v1/classes", data={"from": NOW.isoformat()})
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["data"]]
        assert str(upcoming_class.id) in ids
        assert str(past_class.id) not in ids


# ---------------------------------------------------------------------------
# Participant scoping
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestParticipantScoping:
    def test_participant_in_group_a_cannot_see_group_b_class(
        self, participant_client, participant_user, group, other_group, admin_user
    ):
        GroupMembership.objects.create(group=group, user=participant_user)
        Class.objects.create(group=group, title="Mine", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)
        Class.objects.create(group=other_group, title="Not Mine", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)

        resp = participant_client.get("/api/v1/classes")
        assert resp.status_code == 200
        titles = [c["title"] for c in resp.json()["data"]]
        assert "Mine" in titles
        assert "Not Mine" not in titles

    def test_participant_cannot_create_class(self, participant_client, group):
        resp = participant_client.post(
            "/api/v1/classes",
            {"group_id": str(group.id), "title": "Hack", "starts_at": FUTURE_START.isoformat(), "ends_at": FUTURE_END.isoformat()},
            format="json",
        )
        assert resp.status_code == 403

    def test_participant_cannot_patch_class(self, participant_client, upcoming_class):
        resp = participant_client.patch(f"/api/v1/classes/{upcoming_class.id}", {"title": "Hack"}, format="json")
        assert resp.status_code == 403

    def test_participant_cannot_delete_class(self, participant_client, upcoming_class):
        resp = participant_client.delete(f"/api/v1/classes/{upcoming_class.id}")
        assert resp.status_code == 403

    def test_participant_cannot_retrieve_class_not_in_their_group(
        self, participant_client, upcoming_class
    ):
        # participant_user is not in group — upcoming_class belongs to group
        resp = participant_client.get(f"/api/v1/classes/{upcoming_class.id}")
        assert resp.status_code == 404

    def test_participant_can_retrieve_class_in_their_group(
        self, participant_client, participant_user, upcoming_class
    ):
        GroupMembership.objects.create(group=upcoming_class.group, user=participant_user)
        resp = participant_client.get(f"/api/v1/classes/{upcoming_class.id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == str(upcoming_class.id)


# ---------------------------------------------------------------------------
# /me/calendar
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestParticipantCalendar:
    def test_calendar_returns_participant_classes(
        self, participant_client, participant_user, group, other_group, admin_user
    ):
        GroupMembership.objects.create(group=group, user=participant_user)
        c1 = Class.objects.create(group=group, title="My Class", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)
        Class.objects.create(group=other_group, title="Not Mine", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)

        resp = participant_client.get("/api/v1/me/calendar")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["data"]]
        assert str(c1.id) in ids

    def test_calendar_each_class_has_active_session_field(
        self, participant_client, participant_user, group, admin_user
    ):
        GroupMembership.objects.create(group=group, user=participant_user)
        Class.objects.create(group=group, title="T", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)

        resp = participant_client.get("/api/v1/me/calendar")
        assert resp.status_code == 200
        for cls in resp.json()["data"]:
            assert "active_session" in cls
            assert cls["active_session"] is None  # B-05 not yet present

    def test_calendar_supports_from_to_filter(
        self, participant_client, participant_user, group, admin_user
    ):
        GroupMembership.objects.create(group=group, user=participant_user)
        future = Class.objects.create(group=group, title="Future", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user)
        Class.objects.create(group=group, title="Past", starts_at=PAST_START, ends_at=PAST_END, created_by=admin_user)

        resp = participant_client.get("/api/v1/me/calendar", data={"from": NOW.isoformat()})
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["data"]]
        assert str(future.id) in ids

    def test_calendar_requires_authentication(self):
        c = APIClient()
        resp = c.get("/api/v1/me/calendar")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Response shape contract
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_class_detail_response_shape(admin_client, group, admin_user):
    cls = Class.objects.create(
        group=group, title="Shape Test", starts_at=FUTURE_START, ends_at=FUTURE_END, created_by=admin_user
    )
    resp = admin_client.get(f"/api/v1/classes/{cls.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    required_keys = {
        "id", "group_id", "group_name", "title", "description",
        "starts_at", "ends_at", "status", "created_by_name",
        "active_session", "my_record",
        "attendance_open_at", "attendance_close_at", "allow_late_attendance",
    }
    assert required_keys.issubset(set(data.keys())), f"Missing keys: {required_keys - set(data.keys())}"


# ---------------------------------------------------------------------------
# B-11 — attendance window: API create/read/validate
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAttendanceWindowFields:
    def test_create_with_attendance_window_stores_and_returns_fields(self, admin_client, group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "Window Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
                "attendance_open_at": (FUTURE_START - timedelta(minutes=10)).isoformat(),
                "attendance_close_at": (FUTURE_START + timedelta(minutes=30)).isoformat(),
                "allow_late_attendance": True,
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["attendance_open_at"] is not None
        assert data["attendance_close_at"] is not None
        assert data["allow_late_attendance"] is True

    def test_create_without_attendance_window_returns_null_fields(self, admin_client, group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "No Window Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["attendance_open_at"] is None
        assert data["attendance_close_at"] is None
        assert data["allow_late_attendance"] is False

    def test_get_detail_includes_attendance_window(self, admin_client, group, admin_user):
        cls = Class.objects.create(
            group=group,
            title="Window Get",
            starts_at=FUTURE_START,
            ends_at=FUTURE_END,
            attendance_open_at=FUTURE_START - timedelta(minutes=10),
            attendance_close_at=FUTURE_START + timedelta(minutes=30),
            allow_late_attendance=True,
            created_by=admin_user,
        )
        resp = admin_client.get(f"/api/v1/classes/{cls.id}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["attendance_open_at"] is not None
        assert data["attendance_close_at"] is not None
        assert data["allow_late_attendance"] is True

    def test_attendance_open_at_after_starts_at_returns_400(self, admin_client, group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "Bad Window",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
                # open_at is AFTER starts_at — invalid
                "attendance_open_at": (FUTURE_START + timedelta(minutes=5)).isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_attendance_close_at_before_starts_at_returns_400(self, admin_client, group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "Bad Close Window",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
                # close_at is BEFORE starts_at — invalid
                "attendance_close_at": (FUTURE_START - timedelta(minutes=5)).isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_calendar_includes_attendance_window_fields(
        self, participant_client, participant_user, group, admin_user
    ):
        GroupMembership.objects.create(group=group, user=participant_user)
        Class.objects.create(
            group=group,
            title="Calendar Window",
            starts_at=FUTURE_START,
            ends_at=FUTURE_END,
            attendance_open_at=FUTURE_START - timedelta(minutes=10),
            attendance_close_at=FUTURE_START + timedelta(minutes=30),
            created_by=admin_user,
        )
        resp = participant_client.get("/api/v1/me/calendar")
        assert resp.status_code == 200
        for cls in resp.json()["data"]:
            assert "attendance_open_at" in cls
            assert "attendance_close_at" in cls
            assert "allow_late_attendance" in cls


@pytest.mark.django_db
def test_unauthenticated_access_returns_401():
    c = APIClient()
    resp = c.get("/api/v1/classes")
    assert resp.status_code == 401
