"""Chunk 02 — Instructor scoping tests for the scheduling (classes) app."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupInstructor
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
    return User.objects.create_user(email="admin@sched.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def instructor(db):
    return User.objects.create_user(email="ins@sched.s.test", password="pass", full_name="Instructor", role="INSTRUCTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@sched.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def instructor_client(instructor):
    c = APIClient()
    c.force_authenticate(user=instructor)
    return c


@pytest.fixture
def participant_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def group_a(db, admin):
    return ClassGroup.objects.create(name="Sched Group A", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Sched Group B", created_by=admin)


@pytest.fixture
def assigned(group_a, instructor, admin):
    return GroupInstructor.objects.create(group=group_a, instructor=instructor, assigned_by=admin)


@pytest.fixture
def class_in_a(db, group_a, admin):
    return Class.objects.create(
        group=group_a,
        title="Class in A",
        starts_at=FUTURE_START,
        ends_at=FUTURE_END,
        created_by=admin,
    )


@pytest.fixture
def class_in_b(db, group_b, admin):
    return Class.objects.create(
        group=group_b,
        title="Class in B",
        starts_at=FUTURE_START,
        ends_at=FUTURE_END,
        created_by=admin,
    )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestClassList:
    def test_admin_sees_all_classes(self, admin_client, class_in_a, class_in_b):
        resp = admin_client.get("/api/v1/classes")
        assert resp.status_code == 200
        titles = {c["title"] for c in resp.json()["data"]}
        assert "Class in A" in titles
        assert "Class in B" in titles

    def test_instructor_no_assignment_sees_empty(self, instructor_client, class_in_a):
        resp = instructor_client.get("/api/v1/classes")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_instructor_assigned_sees_only_own_classes(self, instructor_client, assigned, class_in_a, class_in_b):
        resp = instructor_client.get("/api/v1/classes")
        assert resp.status_code == 200
        titles = {c["title"] for c in resp.json()["data"]}
        assert "Class in A" in titles
        assert "Class in B" not in titles

    def test_participant_sees_only_enrolled_classes(self, participant_client, participant, class_in_a, class_in_b):
        from apps.groups.models import GroupMembership
        GroupMembership.objects.create(group=class_in_a.group, user=participant)
        resp = participant_client.get("/api/v1/classes")
        assert resp.status_code == 200
        titles = {c["title"] for c in resp.json()["data"]}
        assert "Class in A" in titles
        assert "Class in B" not in titles


# ---------------------------------------------------------------------------
# Retrieve
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestClassRetrieve:
    def test_admin_retrieves_any_class(self, admin_client, class_in_b):
        resp = admin_client.get(f"/api/v1/classes/{class_in_b.id}")
        assert resp.status_code == 200

    def test_instructor_retrieves_assigned_class(self, instructor_client, assigned, class_in_a):
        resp = instructor_client.get(f"/api/v1/classes/{class_in_a.id}")
        assert resp.status_code == 200

    def test_instructor_cannot_retrieve_unassigned_class(self, instructor_client, class_in_b):
        resp = instructor_client.get(f"/api/v1/classes/{class_in_b.id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestClassCreate:
    def test_instructor_can_create_class_in_assigned_group(self, instructor_client, assigned, group_a):
        resp = instructor_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group_a.id),
                "title": "New Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["title"] == "New Class"

    def test_instructor_cannot_create_class_in_unassigned_group(self, instructor_client, group_b):
        resp = instructor_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group_b.id),
                "title": "Hack Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 403

    def test_participant_cannot_create_class(self, participant_client, group_a):
        resp = participant_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group_a.id),
                "title": "Bad Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update / Delete
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestClassWriteScoping:
    def test_instructor_can_update_assigned_class(self, instructor_client, assigned, class_in_a):
        resp = instructor_client.patch(
            f"/api/v1/classes/{class_in_a.id}",
            {"title": "Updated"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Updated"

    def test_instructor_cannot_update_unassigned_class(self, instructor_client, class_in_b):
        resp = instructor_client.patch(
            f"/api/v1/classes/{class_in_b.id}",
            {"title": "Hacked"},
            format="json",
        )
        assert resp.status_code == 403

    def test_instructor_can_delete_assigned_class(self, instructor_client, assigned, class_in_a):
        resp = instructor_client.delete(f"/api/v1/classes/{class_in_a.id}")
        assert resp.status_code == 204

    def test_instructor_cannot_delete_unassigned_class(self, instructor_client, class_in_b):
        resp = instructor_client.delete(f"/api/v1/classes/{class_in_b.id}")
        assert resp.status_code == 403
