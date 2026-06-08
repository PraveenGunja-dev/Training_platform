"""Chunk 02 — Instructor scoping tests for the analytics app."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupInstructor

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin@anal.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def instructor(db):
    return User.objects.create_user(email="ins@anal.s.test", password="pass", full_name="Instructor", role="INSTRUCTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@anal.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


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
    return ClassGroup.objects.create(name="Anal Group A", created_by=admin)


@pytest.fixture
def assigned(group_a, instructor, admin):
    return GroupInstructor.objects.create(group=group_a, instructor=instructor, assigned_by=admin)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDashboard:
    def test_admin_can_access_dashboard(self, admin_client):
        resp = admin_client.get("/api/v1/dashboard/admin")
        assert resp.status_code == 200
        assert "kpis" in resp.json()["data"]

    def test_instructor_can_access_dashboard(self, instructor_client, assigned):
        resp = instructor_client.get("/api/v1/dashboard/admin")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "kpis" in data
        assert "charts" in data

    def test_instructor_no_assignment_gets_empty_dashboard(self, instructor_client):
        resp = instructor_client.get("/api/v1/dashboard/admin")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["kpis"]["total_groups"] == 0

    def test_participant_cannot_access_admin_dashboard(self, participant_client):
        resp = participant_client.get("/api/v1/dashboard/admin")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Hard-denial sweep — audit, settings, users
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestHardDenials:
    def test_instructor_cannot_access_audit_log(self, instructor_client):
        resp = instructor_client.get("/api/v1/audit")
        assert resp.status_code == 403

    def test_instructor_cannot_access_settings(self, instructor_client):
        resp = instructor_client.get("/api/v1/admin/settings")
        assert resp.status_code == 403

    def test_instructor_cannot_list_users(self, instructor_client):
        resp = instructor_client.get("/api/v1/users")
        assert resp.status_code == 403

    def test_instructor_cannot_invite_user(self, instructor_client):
        resp = instructor_client.post(
            "/api/v1/users",
            {"email": "hack@test.com", "full_name": "Hack", "role": "PARTICIPANT"},
            format="json",
        )
        assert resp.status_code == 403
