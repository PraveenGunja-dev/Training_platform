import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.audit.services import log_action


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        password="pass",
        full_name="Admin User",
        role="ADMIN",
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.mark.django_db
def test_log_action_creates_row(admin_user):
    log_action(
        actor=admin_user,
        action="test.action",
        target_type="TestModel",
        target_id="abc-123",
        metadata={"key": "value"},
    )
    assert AuditLog.objects.count() == 1
    entry = AuditLog.objects.first()
    assert entry is not None
    assert entry.action == "test.action"
    assert entry.target_type == "TestModel"
    assert entry.target_id == "abc-123"
    assert entry.metadata == {"key": "value"}


@pytest.mark.django_db
def test_log_action_no_metadata_defaults_to_empty_dict(admin_user):
    entry = log_action(
        actor=admin_user,
        action="user.login",
        target_type="User",
        target_id=str(admin_user.id),
    )
    assert entry.metadata == {}


@pytest.mark.django_db
def test_audit_list_returns_entry(admin_client, admin_user):
    log_action(
        actor=admin_user,
        action="user.login",
        target_type="User",
        target_id=str(admin_user.id),
    )
    response = admin_client.get("/api/v1/audit")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) >= 1
    assert data[0]["action"] == "user.login"


@pytest.mark.django_db
def test_audit_cursor_pagination(admin_client, admin_user):
    for i in range(25):
        log_action(
            actor=admin_user,
            action=f"test.action.{i}",
            target_type="Test",
            target_id=str(i),
        )
    response = admin_client.get("/api/v1/audit")
    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert len(body["data"]) == 20
    assert body["meta"]["next_cursor"] is not None


@pytest.mark.django_db
def test_audit_filter_by_action(admin_client, admin_user):
    log_action(actor=admin_user, action="user.invite", target_type="User", target_id="u1")
    log_action(actor=admin_user, action="group.create", target_type="Group", target_id="g1")
    response = admin_client.get("/api/v1/audit?action=user.invite")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["action"] == "user.invite"


@pytest.mark.django_db
def test_audit_filter_by_actor_id(admin_client, admin_user, db):
    other_user = User.objects.create_user(
        email="other@test.com", password="pass", full_name="Other", role="ADMIN"
    )
    log_action(actor=admin_user, action="user.login", target_type="User", target_id=str(admin_user.id))
    log_action(actor=other_user, action="user.login", target_type="User", target_id=str(other_user.id))

    response = admin_client.get(f"/api/v1/audit?actor_id={admin_user.id}")
    data = response.json()["data"]
    assert all(r["actor"]["id"] == str(admin_user.id) for r in data)


@pytest.mark.django_db
def test_audit_filter_by_from_date(admin_client, admin_user):
    log_action(actor=admin_user, action="action.one", target_type="X", target_id="1")
    log_action(actor=admin_user, action="action.two", target_type="X", target_id="2")

    # Far-future boundary: no entries match → 0 results
    response = admin_client.get("/api/v1/audit?from=2099-01-01T00:00:00Z")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 0

    # Far-past boundary: all entries match → 2 results
    response = admin_client.get("/api/v1/audit?from=2000-01-01T00:00:00Z")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 2


@pytest.mark.django_db
def test_audit_filter_by_to_date(admin_client, admin_user):
    log_action(actor=admin_user, action="action.one", target_type="X", target_id="1")
    log_action(actor=admin_user, action="action.two", target_type="X", target_id="2")

    # Far-past boundary: no entries match → 0 results
    response = admin_client.get("/api/v1/audit?to=2000-01-01T00:00:00Z")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 0

    # Far-future boundary: all entries match → 2 results
    response = admin_client.get("/api/v1/audit?to=2099-01-01T00:00:00Z")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 2


@pytest.mark.django_db
def test_audit_log_is_append_only(admin_user):
    entry = log_action(
        actor=admin_user,
        action="test.action",
        target_type="Test",
        target_id="1",
    )
    with pytest.raises(PermissionError):
        entry.save()


@pytest.mark.django_db
def test_audit_log_cannot_be_deleted(admin_user):
    entry = log_action(
        actor=admin_user,
        action="test.action",
        target_type="Test",
        target_id="1",
    )
    with pytest.raises(PermissionError):
        entry.delete()
