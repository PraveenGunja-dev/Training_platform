"""Tests for admin settings endpoint (B-14).

Covers:
- GET /api/v1/admin/settings — 200 with all 8 fields (admin only)
- PATCH /api/v1/admin/settings — 200, value updated
- PATCH with invalid brand_color — 400
- Unauthenticated — 401
- Participant — 403
- Singleton: get_solo() returns same row on repeated calls
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.common.models import SystemSettings

User = get_user_model()

SETTINGS_URL = "/api/v1/admin/settings"


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email="settings_admin@test.com",
        password="pass",
        full_name="Settings Admin",
        role="ADMIN",
    )


@pytest.fixture
def participant(db):
    return User.objects.create_user(
        email="settings_part@test.com",
        password="pass",
        full_name="Settings Participant",
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


# ---------------------------------------------------------------------------
# GET
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_settings_returns_all_fields(admin_client):
    resp = admin_client.get(SETTINGS_URL)
    assert resp.status_code == 200
    data = resp.data["data"]
    assert "product_name" in data
    assert "timezone" in data
    assert "brand_color" in data
    assert "doc_max_mb" in data
    assert "image_max_mb" in data
    assert "video_max_mb" in data
    assert "reminder_offsets" in data
    assert "session_lifetime_hours" in data


@pytest.mark.django_db
def test_get_settings_defaults(admin_client):
    resp = admin_client.get(SETTINGS_URL)
    assert resp.status_code == 200
    data = resp.data["data"]
    assert data["doc_max_mb"] == 25
    assert data["image_max_mb"] == 10
    assert data["video_max_mb"] == 500
    assert data["brand_color"] == "#4F46E5"
    assert data["session_lifetime_hours"] == 24


@pytest.mark.django_db
def test_get_settings_unauthenticated():
    c = APIClient()
    resp = c.get(SETTINGS_URL)
    assert resp.status_code == 401


@pytest.mark.django_db
def test_get_settings_participant_forbidden(part_client):
    resp = part_client.get(SETTINGS_URL)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_settings_updates_value(admin_client):
    resp = admin_client.patch(SETTINGS_URL, {"doc_max_mb": 50}, format="json")
    assert resp.status_code == 200
    assert resp.data["data"]["doc_max_mb"] == 50
    # Persisted in DB
    assert SystemSettings.get_solo().doc_max_mb == 50


@pytest.mark.django_db
def test_patch_settings_invalid_brand_color(admin_client):
    resp = admin_client.patch(SETTINGS_URL, {"brand_color": "notacolor"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_patch_settings_valid_brand_color(admin_client):
    resp = admin_client.patch(SETTINGS_URL, {"brand_color": "#AABBCC"}, format="json")
    assert resp.status_code == 200
    assert resp.data["data"]["brand_color"] == "#AABBCC"


@pytest.mark.django_db
def test_patch_settings_partial_update_preserves_other_fields(admin_client):
    # First set product_name
    admin_client.patch(SETTINGS_URL, {"product_name": "My Portal"}, format="json")
    # Then patch only doc_max_mb
    resp = admin_client.patch(SETTINGS_URL, {"doc_max_mb": 100}, format="json")
    assert resp.status_code == 200
    data = resp.data["data"]
    assert data["doc_max_mb"] == 100
    assert data["product_name"] == "My Portal"


# ---------------------------------------------------------------------------
# Singleton invariant
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_get_solo_creates_row_on_first_call():
    assert SystemSettings.objects.count() == 0
    obj = SystemSettings.get_solo()
    assert obj.pk == 1
    assert SystemSettings.objects.count() == 1


@pytest.mark.django_db
def test_get_solo_idempotent():
    SystemSettings.get_solo()
    SystemSettings.get_solo()
    assert SystemSettings.objects.count() == 1
