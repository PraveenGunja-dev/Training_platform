"""Tests for sub_group FK on Class model (Chunk C)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, SubGroup
from apps.scheduling.models import Class

User = get_user_model()

NOW = timezone.now()
FUTURE_START = NOW + timedelta(hours=2)
FUTURE_END = NOW + timedelta(hours=4)


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@sgfk.sched.test", password="pass", full_name="Admin SGfk", role="ADMIN"
    )


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(name="SGfk Test Batch", created_by=admin_user)


@pytest.fixture
def other_group(db, admin_user):
    return ClassGroup.objects.create(name="SGfk Other Batch", created_by=admin_user)


@pytest.fixture
def sub_group(db, group, admin_user):
    return SubGroup.objects.create(name="Sub A", parent_group=group, created_by=admin_user)


@pytest.fixture
def other_sub_group(db, other_group, admin_user):
    return SubGroup.objects.create(name="Sub B", parent_group=other_group, created_by=admin_user)


@pytest.mark.django_db
class TestClassSubGroupField:
    def test_model_has_sub_group_field(self):
        field_names = {f.name for f in Class._meta.get_fields()}
        assert "sub_group" in field_names

    def test_create_class_with_sub_group(self, admin_client, group, sub_group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "sub_group_id": str(sub_group.id),
                "title": "Sub-Group Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert str(resp.data["data"]["sub_group_id"]) == str(sub_group.id)

    def test_create_class_without_sub_group(self, admin_client, group):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "title": "No Sub-Group Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert resp.data["data"]["sub_group_id"] is None

    def test_create_class_with_wrong_group_sub_group_fails(
        self, admin_client, group, other_sub_group
    ):
        resp = admin_client.post(
            "/api/v1/classes",
            {
                "group_id": str(group.id),
                "sub_group_id": str(other_sub_group.id),
                "title": "Bad Sub-Group Class",
                "starts_at": FUTURE_START.isoformat(),
                "ends_at": FUTURE_END.isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_class_with_null_sub_group_returns_null(self, admin_client, group):
        cls = Class.objects.create(
            group=group, title="T", starts_at=FUTURE_START, ends_at=FUTURE_END
        )
        resp = admin_client.get(f"/api/v1/classes/{cls.id}")
        assert resp.status_code == 200
        assert resp.data["data"]["sub_group_id"] is None
