"""Chunk 02 — Sub-Mentor scoping tests for the scheduling (classes) app."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupSubMentor
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
def sub_mentor(db):
    return User.objects.create_user(email="ins@sched.s.test", password="pass", full_name="Sub-Mentor", role="SUB_MENTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@sched.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


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
    return ClassGroup.objects.create(name="Sched Group A", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Sched Group B", created_by=admin)


@pytest.fixture
def assigned(group_a, sub_mentor, admin):
    return GroupSubMentor.objects.create(group=group_a, sub_mentor=sub_mentor, assigned_by=admin)


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
        resp = admin_client.get("/training/api/v1/classes")
        assert resp.status_code == 200
        titles = {c["title"] for c in resp.json()["data"]}
        assert "Class in A" in titles
        assert "Class in B" in titles

    def test_sub_mentor_no_assignment_sees_empty(self, sub_mentor_client, class_in_a):
        resp = sub_mentor_client.get("/training/api/v1/classes")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_sub_mentor_assigned_sees_only_own_classes(self, sub_mentor_client, assigned, class_in_a, class_in_b):
        resp = sub_mentor_client.get("/training/api/v1/classes")
        assert resp.status_code == 200
        titles = {c["title"] for c in resp.json()["data"]}
        assert "Class in A" in titles
        assert "Class in B" not in titles

    def test_participant_sees_only_enrolled_classes(self, participant_client, participant, class_in_a, class_in_b):
        from apps.groups.models import GroupMembership
        GroupMembership.objects.create(group=class_in_a.group, user=participant)
        resp = participant_client.get("/training/api/v1/classes")
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
        resp = admin_client.get(f"/training/api/v1/classes/{class_in_b.id}")
        assert resp.status_code == 200

    def test_sub_mentor_retrieves_assigned_class(self, sub_mentor_client, assigned, class_in_a):
        resp = sub_mentor_client.get(f"/training/api/v1/classes/{class_in_a.id}")
        assert resp.status_code == 200

    def test_sub_mentor_cannot_retrieve_unassigned_class(self, sub_mentor_client, class_in_b):
        resp = sub_mentor_client.get(f"/training/api/v1/classes/{class_in_b.id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestClassCreate:
    def test_sub_mentor_can_create_class_in_assigned_group(self, sub_mentor_client, assigned, group_a):
        resp = sub_mentor_client.post(
            "/training/api/v1/classes",
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

    def test_sub_mentor_cannot_create_class_in_unassigned_group(self, sub_mentor_client, group_b):
        resp = sub_mentor_client.post(
            "/training/api/v1/classes",
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
            "/training/api/v1/classes",
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
    def test_sub_mentor_can_update_assigned_class(self, sub_mentor_client, assigned, class_in_a):
        resp = sub_mentor_client.patch(
            f"/training/api/v1/classes/{class_in_a.id}",
            {"title": "Updated"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Updated"

    def test_sub_mentor_cannot_update_unassigned_class(self, sub_mentor_client, class_in_b):
        resp = sub_mentor_client.patch(
            f"/training/api/v1/classes/{class_in_b.id}",
            {"title": "Hacked"},
            format="json",
        )
        assert resp.status_code == 403

    def test_sub_mentor_can_delete_assigned_class(self, sub_mentor_client, assigned, class_in_a):
        resp = sub_mentor_client.delete(f"/training/api/v1/classes/{class_in_a.id}")
        assert resp.status_code == 204

    def test_sub_mentor_cannot_delete_unassigned_class(self, sub_mentor_client, class_in_b):
        resp = sub_mentor_client.delete(f"/training/api/v1/classes/{class_in_b.id}")
        assert resp.status_code == 403
