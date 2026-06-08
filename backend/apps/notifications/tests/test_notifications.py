"""Tests for the notifications app (B-09).

Covers:
- create_inapp service: creates notification, deduplication
- GET /api/v1/notifications/ — list (user-scoped)
- GET /api/v1/notifications/unread-count
- POST /api/v1/notifications/:id/read — marks single notification read
- POST /api/v1/notifications/read-all — marks all unread as read
- Cross-user isolation: mark-read on another user's notification does nothing
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.notifications.services import create_inapp

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="notif_user@test.com",
        password="pass",
        full_name="Notif User",
        role="PARTICIPANT",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email="other_user@test.com",
        password="pass",
        full_name="Other User",
        role="PARTICIPANT",
    )


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def other_client(other_user):
    c = APIClient()
    c.force_authenticate(user=other_user)
    return c


def make_notification(user, dedupe_key="test:key:1", read=False):
    n = Notification.objects.create(
        user=user,
        type="TASK_OPENED",
        channel="IN_APP",
        title="Test Notification",
        body="A task has been opened.",
        link="/me/dashboard",
        dedupe_key=dedupe_key,
        status="SENT",
        sent_at=timezone.now(),
        payload={},
    )
    if read:
        n.read_at = timezone.now()
        n.save(update_fields=["read_at"])
    return n


# ---------------------------------------------------------------------------
# Service tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_inapp_creates_notification(user):
    notif = create_inapp(
        user=user,
        type="TASK_OPENED",
        title="New Task",
        body="A task is now open.",
        link="/me/tasks",
        dedupe_key="task_opened:99",
        payload={"task_id": "99"},
    )
    assert notif is not None
    assert notif.type == "TASK_OPENED"
    assert notif.user == user
    assert notif.dedupe_key == "task_opened:99"
    assert Notification.objects.filter(dedupe_key="task_opened:99").count() == 1


@pytest.mark.django_db
def test_create_inapp_dedupe_returns_existing(user):
    notif1 = create_inapp(
        user=user,
        type="TASK_OPENED",
        title="First",
        body="First call.",
        link="/me/tasks",
        dedupe_key="dedup:abc",
        payload={},
    )
    notif2 = create_inapp(
        user=user,
        type="TASK_OPENED",
        title="Second",
        body="Second call — should not create new row.",
        link="/me/tasks",
        dedupe_key="dedup:abc",
        payload={},
    )
    assert notif1.id == notif2.id
    assert Notification.objects.filter(dedupe_key="dedup:abc").count() == 1
    # Title should still be from the first call (not updated)
    assert notif2.title == "First"


# ---------------------------------------------------------------------------
# List endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_notifications(client, user):
    make_notification(user, dedupe_key="notif:1")
    make_notification(user, dedupe_key="notif:2")
    resp = client.get("/api/v1/notifications")
    assert resp.status_code == 200
    assert "data" in resp.data
    assert len(resp.data["data"]) == 2
    assert "meta" in resp.data


@pytest.mark.django_db
def test_list_notifications_only_returns_own(client, user, other_user):
    make_notification(user, dedupe_key="mine:1")
    make_notification(other_user, dedupe_key="theirs:1")
    resp = client.get("/api/v1/notifications")
    assert resp.status_code == 200
    assert len(resp.data["data"]) == 1
    assert resp.data["data"][0]["title"] == "Test Notification"


@pytest.mark.django_db
def test_list_notifications_unauthenticated():
    c = APIClient()
    resp = c.get("/api/v1/notifications")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Unread count
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unread_count(client, user):
    make_notification(user, dedupe_key="unread:1")
    make_notification(user, dedupe_key="unread:2")
    make_notification(user, dedupe_key="read:1", read=True)
    resp = client.get("/api/v1/notifications/unread-count")
    assert resp.status_code == 200
    assert resp.data["data"]["unread_count"] == 2


@pytest.mark.django_db
def test_unread_count_zero_when_all_read(client, user):
    make_notification(user, dedupe_key="r:1", read=True)
    make_notification(user, dedupe_key="r:2", read=True)
    resp = client.get("/api/v1/notifications/unread-count")
    assert resp.status_code == 200
    assert resp.data["data"]["unread_count"] == 0


# ---------------------------------------------------------------------------
# Mark single read
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_mark_read(client, user):
    notif = make_notification(user, dedupe_key="mr:1")
    assert notif.read_at is None
    resp = client.post(f"/api/v1/notifications/{notif.id}/read")
    assert resp.status_code == 204
    notif.refresh_from_db()
    assert notif.read_at is not None


@pytest.mark.django_db
def test_mark_read_already_read_is_noop(client, user):
    notif = make_notification(user, dedupe_key="mr:already", read=True)
    original_read_at = notif.read_at
    resp = client.post(f"/api/v1/notifications/{notif.id}/read")
    assert resp.status_code == 204
    notif.refresh_from_db()
    # read_at should not have changed (filter requires read_at__isnull=True)
    assert notif.read_at == original_read_at


# ---------------------------------------------------------------------------
# Mark all read
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_mark_read_all(client, user):
    make_notification(user, dedupe_key="all:1")
    make_notification(user, dedupe_key="all:2")
    make_notification(user, dedupe_key="all:3")
    resp = client.post("/api/v1/notifications/read-all")
    assert resp.status_code == 204
    unread_count = Notification.objects.filter(user=user, read_at__isnull=True).count()
    assert unread_count == 0


@pytest.mark.django_db
def test_mark_read_all_only_affects_own_notifications(client, user, other_user):
    make_notification(user, dedupe_key="own:1")
    other_notif = make_notification(other_user, dedupe_key="others:1")
    resp = client.post("/api/v1/notifications/read-all")
    assert resp.status_code == 204
    # Other user's notification should still be unread
    other_notif.refresh_from_db()
    assert other_notif.read_at is None


# ---------------------------------------------------------------------------
# Cross-user isolation for mark-read
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_other_user_cannot_read_my_notification(client, other_client, user, other_user):
    notif = make_notification(user, dedupe_key="cross:1")
    # other_client tries to mark user's notification as read
    resp = other_client.post(f"/api/v1/notifications/{notif.id}/read")
    # Returns 204 (idempotent) but notification should NOT be updated
    assert resp.status_code == 204
    notif.refresh_from_db()
    assert notif.read_at is None
