"""Chunk 02 — Sub-Mentor scoping tests for the analytics app."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupSubMentor

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin@anal.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def sub_mentor(db):
    return User.objects.create_user(email="ins@anal.s.test", password="pass", full_name="Sub-Mentor", role="SUB_MENTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@anal.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


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
    return ClassGroup.objects.create(name="Anal Group A", created_by=admin)


@pytest.fixture
def assigned(group_a, sub_mentor, admin):
    return GroupSubMentor.objects.create(group=group_a, sub_mentor=sub_mentor, assigned_by=admin)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDashboard:
    def test_admin_can_access_dashboard(self, admin_client):
        resp = admin_client.get("/training/api/v1/dashboard/admin")
        assert resp.status_code == 200
        assert "kpis" in resp.json()["data"]

    def test_sub_mentor_can_access_dashboard(self, sub_mentor_client, assigned):
        resp = sub_mentor_client.get("/training/api/v1/dashboard/admin")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "kpis" in data
        assert "charts" in data

    def test_sub_mentor_no_assignment_gets_empty_dashboard(self, sub_mentor_client):
        resp = sub_mentor_client.get("/training/api/v1/dashboard/admin")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["kpis"]["total_groups"] == 0

    def test_participant_cannot_access_admin_dashboard(self, participant_client):
        resp = participant_client.get("/training/api/v1/dashboard/admin")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Hard-denial sweep — audit, settings, users
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestHardDenials:
    def test_sub_mentor_cannot_access_audit_log(self, sub_mentor_client):
        resp = sub_mentor_client.get("/training/api/v1/audit")
        assert resp.status_code == 403

    def test_sub_mentor_cannot_access_settings(self, sub_mentor_client):
        resp = sub_mentor_client.get("/training/api/v1/admin/settings")
        assert resp.status_code == 403

    def test_sub_mentor_cannot_list_users(self, sub_mentor_client):
        resp = sub_mentor_client.get("/training/api/v1/users")
        assert resp.status_code == 403

    def test_sub_mentor_cannot_invite_user(self, sub_mentor_client):
        resp = sub_mentor_client.post(
            "/training/api/v1/users",
            {"email": "hack@test.com", "full_name": "Hack", "role": "PARTICIPANT"},
            format="json",
        )
        assert resp.status_code == 403
