"""Chunk 08 — Cross-sub_mentor visibility tests for the scheduling app.

Verifies that the effective sub_mentor_can_view_all flag (resolved from the
tri-state user override + system default) correctly:
  - Expands the class list queryset to the superset (all groups) when ON.
  - Annotates each row with read_only=False (assigned) or read_only=True (not).
  - Still 403s write operations on non-assigned groups regardless of flag.
  - Strictly filters to assigned groups when OFF (override wins over system).
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.common.models import SystemSettings
from apps.groups.models import ClassGroup, GroupSubMentor
from apps.scheduling.models import Class

User = get_user_model()

NOW = timezone.now()
FUTURE_START = NOW + timedelta(hours=2)
FUTURE_END = NOW + timedelta(hours=4)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email="admin@cv8.test", password="pass", full_name="Admin CV8", role="ADMIN"
    )


@pytest.fixture
def sub_mentor(db):
    return User.objects.create_user(
        email="ins@cv8.test", password="pass", full_name="Sub-Mentor CV8", role="SUB_MENTOR"
    )


@pytest.fixture
def sub_mentor_client(sub_mentor):
    c = APIClient()
    c.force_authenticate(user=sub_mentor)
    return c


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def group_a(db, admin):
    return ClassGroup.objects.create(name="Group A CV8", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Group B CV8", created_by=admin)


@pytest.fixture
def assigned_group(group_a, sub_mentor):
    GroupSubMentor.objects.create(group=group_a, sub_mentor=sub_mentor, assigned_by=None)
    return group_a


@pytest.fixture
def class_assigned(admin, assigned_group):
    return Class.objects.create(
        group=assigned_group,
        title="Assigned Class CV8",
        starts_at=FUTURE_START,
        ends_at=FUTURE_END,
        created_by=admin,
    )


@pytest.fixture
def class_unassigned(admin, group_b):
    return Class.objects.create(
        group=group_b,
        title="Unassigned Class CV8",
        starts_at=FUTURE_START,
        ends_at=FUTURE_END,
        created_by=admin,
    )


@pytest.fixture
def settings_on(db):
    s = SystemSettings.get_solo()
    s.sub_mentors_can_view_all_classes = True
    s.save()
    yield s
    s.sub_mentors_can_view_all_classes = False
    s.save()


@pytest.fixture
def settings_off(db):
    s = SystemSettings.get_solo()
    s.sub_mentors_can_view_all_classes = False
    s.save()
    return s


# ---------------------------------------------------------------------------
# Test 1: system flag ON, no user override → superset returned; read_only correct
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_superset_system_on_no_override(
    sub_mentor_client, sub_mentor, class_assigned, class_unassigned, settings_on
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.get("/training/api/v1/classes")
    assert resp.status_code == 200

    ids = {c["id"] for c in resp.data["data"]}
    assert str(class_assigned.id) in ids
    assert str(class_unassigned.id) in ids

    assigned_row = next(c for c in resp.data["data"] if c["id"] == str(class_assigned.id))
    unassigned_row = next(c for c in resp.data["data"] if c["id"] == str(class_unassigned.id))
    assert assigned_row["read_only"] is False
    assert unassigned_row["read_only"] is True


# ---------------------------------------------------------------------------
# Test 2: system flag OFF, user override True → superset returned
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_superset_user_override_on(
    sub_mentor_client, sub_mentor, class_assigned, class_unassigned, settings_off
):
    sub_mentor.can_view_all_classes = True
    sub_mentor.save()

    resp = sub_mentor_client.get("/training/api/v1/classes")
    assert resp.status_code == 200

    ids = {c["id"] for c in resp.data["data"]}
    assert str(class_assigned.id) in ids
    assert str(class_unassigned.id) in ids


# ---------------------------------------------------------------------------
# Test 3: user override False, system ON → only assigned (override wins)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_list_assigned_only_user_override_off_wins(
    sub_mentor_client, sub_mentor, class_assigned, class_unassigned, settings_on
):
    sub_mentor.can_view_all_classes = False
    sub_mentor.save()

    resp = sub_mentor_client.get("/training/api/v1/classes")
    assert resp.status_code == 200

    ids = {c["id"] for c in resp.data["data"]}
    assert str(class_assigned.id) in ids
    assert str(class_unassigned.id) not in ids


# ---------------------------------------------------------------------------
# Test 4: effective ON, GET detail of unassigned class → 200 + read_only=true
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_retrieve_unassigned_effective_on_200_read_only(
    sub_mentor_client, sub_mentor, class_unassigned, settings_on
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.get(f"/training/api/v1/classes/{class_unassigned.id}")
    assert resp.status_code == 200
    assert resp.data["data"]["read_only"] is True


# ---------------------------------------------------------------------------
# Test 5: effective OFF, GET detail of unassigned class → 404
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_retrieve_unassigned_effective_off_404(
    sub_mentor_client, sub_mentor, class_unassigned, settings_off
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.get(f"/training/api/v1/classes/{class_unassigned.id}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Test 6: PATCH on unassigned class with effective ON → still 403
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_patch_unassigned_effective_on_still_403(
    sub_mentor_client, sub_mentor, class_unassigned, settings_on
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.patch(
        f"/training/api/v1/classes/{class_unassigned.id}",
        {"title": "Hijacked"},
        format="json",
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Test 7: assigned class always has read_only=false (sanity check both flag states)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_assigned_class_read_only_always_false(
    sub_mentor_client, sub_mentor, class_assigned, settings_on
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.get(f"/training/api/v1/classes/{class_assigned.id}")
    assert resp.status_code == 200
    assert resp.data["data"]["read_only"] is False


# ---------------------------------------------------------------------------
# Test 8: me/groups returns effective_can_view_all boolean
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_me_groups_returns_effective_can_view_all_true(
    sub_mentor_client, sub_mentor, assigned_group, settings_on
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.get("/training/api/v1/me/groups")  # no trailing slash (router: trailing_slash=False)
    assert resp.status_code == 200
    assert resp.data["effective_can_view_all"] is True


@pytest.mark.django_db
def test_me_groups_returns_effective_can_view_all_false(
    sub_mentor_client, sub_mentor, assigned_group, settings_off
):
    sub_mentor.can_view_all_classes = None
    sub_mentor.save()

    resp = sub_mentor_client.get("/training/api/v1/me/groups")  # no trailing slash (router: trailing_slash=False)
    assert resp.status_code == 200
    assert resp.data["effective_can_view_all"] is False
