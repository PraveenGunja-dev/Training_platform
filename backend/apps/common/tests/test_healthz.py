import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_healthz_returns_200(client):
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["db"] == "ok"
    assert "redis" in data
    assert "scheduler" in data
    assert data["version"] == "v0.1.0"


@pytest.mark.django_db
def test_healthz_scheduler_degraded_before_beat(client):
    """Scheduler reports degraded until B-08 wires the heartbeat task."""
    response = client.get("/api/v1/healthz")
    assert response.json()["data"]["scheduler"] == "degraded"


@pytest.mark.django_db
def test_healthz_scheduler_ok_after_recent_heartbeat(client):
    from django.utils import timezone

    from apps.common.models import SchedulerHealth

    SchedulerHealth.objects.create(last_heartbeat_at=timezone.now())
    response = client.get("/api/v1/healthz")
    assert response.json()["data"]["scheduler"] == "ok"


@pytest.mark.django_db
def test_healthz_no_auth_required(client):
    """healthz is a public endpoint — no token needed."""
    response = client.get("/api/v1/healthz")
    assert response.status_code != 401
