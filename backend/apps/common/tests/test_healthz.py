import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_healthz_returns_200(client):
    # Unauthenticated callers get the minimal two-field response (L-09).
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.django_db
def test_healthz_scheduler_degraded_before_beat():
    """Scheduler helper reports degraded until the heartbeat task fires."""
    from apps.common.views import _check_scheduler
    assert _check_scheduler() == "degraded"


@pytest.mark.django_db
def test_healthz_scheduler_ok_after_recent_heartbeat():
    from django.utils import timezone

    from apps.common.models import SchedulerHealth
    from apps.common.views import _check_scheduler

    SchedulerHealth.objects.create(last_heartbeat_at=timezone.now())
    assert _check_scheduler() == "ok"


@pytest.mark.django_db
def test_healthz_no_auth_required(client):
    """healthz is a public endpoint — no token needed."""
    response = client.get("/api/v1/healthz")
    assert response.status_code != 401
