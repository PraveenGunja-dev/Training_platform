import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        password="pass",
        full_name="Admin User",
        role="ADMIN",
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@test.com",
        password="pass",
        full_name="Participant User",
        role="PARTICIPANT",
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def participant_client(participant_user):
    client = APIClient()
    client.force_authenticate(user=participant_user)
    return client


@pytest.mark.django_db
def test_admin_can_reach_audit_endpoint(admin_client):
    response = admin_client.get("/api/v1/audit")
    assert response.status_code == 200


@pytest.mark.django_db
def test_participant_gets_403_on_audit(participant_client):
    response = participant_client.get("/api/v1/audit")
    assert response.status_code == 403


@pytest.mark.django_db
def test_403_response_matches_envelope_shape(participant_client):
    response = participant_client.get("/api/v1/audit")
    body = response.json()
    assert body["data"] is None
    assert isinstance(body["errors"], list)
    assert len(body["errors"]) > 0
    error = body["errors"][0]
    assert "code" in error
    assert "message" in error


@pytest.mark.django_db
def test_unauthenticated_gets_401_envelope():
    anon = APIClient()
    response = anon.get("/api/v1/audit")
    assert response.status_code == 401
    body = response.json()
    assert body["data"] is None
    assert isinstance(body["errors"], list)
