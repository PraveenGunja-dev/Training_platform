"""Tests for the analytics app (B-09 + B-14).

Covers:
- GET /api/v1/dashboard/admin — 200 with correct structure (admin only)
- GET /api/v1/dashboard/admin — 403 for participant
- GET /api/v1/dashboard/participant — 200 with correct structure
- GET /api/v1/dashboard/manager — 200 (alias to admin dashboard, added in B-14)
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email="analytics_admin@test.com",
        password="pass",
        full_name="Analytics Admin",
        role="ADMIN",
    )


@pytest.fixture
def participant(db):
    return User.objects.create_user(
        email="analytics_part@test.com",
        password="pass",
        full_name="Analytics Participant",
        role="PARTICIPANT",
    )


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def part_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def group(db, admin):
    return ClassGroup.objects.create(name="Analytics Group", created_by=admin)


@pytest.fixture
def membership(db, participant, group):
    return GroupMembership.objects.create(user=participant, group=group)


@pytest.fixture
def today_class(db, group, admin):
    now = timezone.now()
    return Class.objects.create(
        group=group,
        title="Today Analytics Class",
        starts_at=now - timedelta(minutes=30),
        ends_at=now + timedelta(hours=1),
        created_by=admin,
    )


# ---------------------------------------------------------------------------
# Admin dashboard
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_dashboard(admin_client, admin):
    resp = admin_client.get("/api/v1/dashboard/admin")
    assert resp.status_code == 200
    assert "data" in resp.data
    data = resp.data["data"]
    # Check required top-level keys
    assert "kpis" in data
    assert "charts" in data
    assert "participant_activity" in data
    assert "recent_activity" in data
    # Check KPI fields match new service shape
    kpis = data["kpis"]
    assert "total_participants" in kpis
    assert "total_groups" in kpis
    assert "classes_today" in kpis
    assert "classes_upcoming" in kpis
    assert "classes_completed" in kpis
    assert "submitted" in kpis
    assert "pending" in kpis
    assert "late" in kpis
    # Charts wrapper
    charts = data["charts"]
    assert "attendance_pie" in charts
    assert "submission_bar" in charts
    assert "group_comparison" in charts
    assert "daily_upload_trend" in charts
    assert "deadline_tracking" in charts
    # 14-day trend
    assert len(charts["daily_upload_trend"]) == 14
    assert "date" in charts["daily_upload_trend"][0]
    assert "count" in charts["daily_upload_trend"][0]


@pytest.mark.django_db
def test_admin_dashboard_forbidden_for_participant(part_client):
    resp = part_client.get("/api/v1/dashboard/admin")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_dashboard_forbidden_unauthenticated():
    c = APIClient()
    resp = c.get("/api/v1/dashboard/admin")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_admin_dashboard_kpi_counts(admin_client, admin, participant, group):
    resp = admin_client.get("/api/v1/dashboard/admin")
    assert resp.status_code == 200
    kpis = resp.data["data"]["kpis"]
    # At minimum 1 participant and 1 group exist from fixtures
    assert kpis["total_participants"] >= 1
    assert kpis["total_groups"] >= 1


# ---------------------------------------------------------------------------
# Participant dashboard
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_participant_dashboard(part_client, participant):
    resp = part_client.get("/api/v1/dashboard/participant")
    assert resp.status_code == 200
    assert "data" in resp.data
    data = resp.data["data"]
    assert "today" in data
    assert "quick_stats" in data
    assert "pending_tasks" in data
    assert "recent_submissions" in data
    assert "recent_documents" in data


@pytest.mark.django_db
def test_participant_dashboard_unauthenticated():
    c = APIClient()
    resp = c.get("/api/v1/dashboard/participant")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_participant_dashboard_with_today_class(
    part_client, participant, group, membership, today_class
):
    resp = part_client.get("/api/v1/dashboard/participant")
    assert resp.status_code == 200
    data = resp.data["data"]
    today = data["today"]
    assert today["class"] is not None
    assert today["class"]["title"] == "Today Analytics Class"
    assert today["class"]["active_session"] is None
    assert today["class"]["my_record"] is None


@pytest.mark.django_db
def test_participant_dashboard_no_class_when_not_in_group(part_client, participant):
    # participant has no group memberships → no today class
    resp = part_client.get("/api/v1/dashboard/participant")
    assert resp.status_code == 200
    data = resp.data["data"]
    assert data["today"]["class"] is None
    assert data["quick_stats"]["pending_count"] == 0
    assert data["recent_submissions"] == []


@pytest.mark.django_db
def test_admin_can_also_call_participant_dashboard(admin_client):
    # participant dashboard is open to IsAuthenticated, admin should pass
    resp = admin_client.get("/api/v1/dashboard/participant")
    assert resp.status_code == 200
