"""Chunk 02 — Instructor scoping tests for the groups app."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin@grp.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def instructor(db):
    return User.objects.create_user(email="ins@grp.s.test", password="pass", full_name="Instructor", role="INSTRUCTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@grp.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


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
    return ClassGroup.objects.create(name="Group A", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Group B", created_by=admin)


@pytest.fixture
def assigned_instructor(group_a, instructor, admin):
    return GroupInstructor.objects.create(group=group_a, instructor=instructor, assigned_by=admin)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupList:
    def test_admin_sees_all_groups(self, admin_client, group_a, group_b):
        resp = admin_client.get("/api/v1/groups")
        assert resp.status_code == 200
        names = {g["name"] for g in resp.json()["data"]}
        assert "Group A" in names
        assert "Group B" in names

    def test_instructor_no_assignment_sees_empty(self, instructor_client, group_a, group_b):
        resp = instructor_client.get("/api/v1/groups")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_instructor_assigned_sees_only_own_group(self, instructor_client, assigned_instructor, group_a, group_b):
        resp = instructor_client.get("/api/v1/groups")
        assert resp.status_code == 200
        names = {g["name"] for g in resp.json()["data"]}
        assert "Group A" in names
        assert "Group B" not in names

    def test_participant_sees_only_enrolled_groups(self, participant_client, participant, group_a, group_b):
        GroupMembership.objects.create(group=group_a, user=participant)
        resp = participant_client.get("/api/v1/groups")
        assert resp.status_code == 200
        names = {g["name"] for g in resp.json()["data"]}
        assert "Group A" in names
        assert "Group B" not in names


# ---------------------------------------------------------------------------
# Retrieve
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupRetrieve:
    def test_admin_retrieves_any_group(self, admin_client, group_b):
        resp = admin_client.get(f"/api/v1/groups/{group_b.id}")
        assert resp.status_code == 200

    def test_instructor_retrieves_assigned_group(self, instructor_client, assigned_instructor, group_a):
        resp = instructor_client.get(f"/api/v1/groups/{group_a.id}")
        assert resp.status_code == 200

    def test_instructor_cannot_retrieve_unassigned_group(self, instructor_client, group_b):
        resp = instructor_client.get(f"/api/v1/groups/{group_b.id}")
        assert resp.status_code == 403
        assert resp.json()["errors"][0]["code"] == "perm.not_instructor_of_group"

    def test_participant_cannot_retrieve_unenrolled_group(self, participant_client, group_a):
        resp = participant_client.get(f"/api/v1/groups/{group_a.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Write hard denials for instructor
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupWriteDenials:
    def test_instructor_cannot_create_group(self, instructor_client):
        resp = instructor_client.post("/api/v1/groups", {"name": "New", "description": ""}, format="json")
        assert resp.status_code == 403

    def test_instructor_cannot_delete_group(self, instructor_client, group_a):
        resp = instructor_client.delete(f"/api/v1/groups/{group_a.id}")
        assert resp.status_code == 403

    def test_instructor_cannot_add_participants(self, instructor_client, group_a, participant):
        resp = instructor_client.post(
            f"/api/v1/groups/{group_a.id}/participants",
            {"user_ids": [str(participant.id)]},
            format="json",
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Analytics action
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupAnalytics:
    def test_instructor_can_access_analytics_on_assigned_group(self, instructor_client, assigned_instructor, group_a):
        resp = instructor_client.get(f"/api/v1/groups/{group_a.id}/analytics")
        assert resp.status_code == 200

    def test_instructor_cannot_access_analytics_on_unassigned_group(self, instructor_client, group_b):
        resp = instructor_client.get(f"/api/v1/groups/{group_b.id}/analytics")
        assert resp.status_code == 403
