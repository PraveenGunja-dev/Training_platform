"""Tests for SubGroup CRUD and analytics sub_group_id filter."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupMembership, SubGroup, SubGroupMembership

User = get_user_model()

_counter = 0


def _uid():
    global _counter
    _counter += 1
    return _counter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email=f"admin{_uid()}@sg.test", password="pass", full_name="Admin User", role="ADMIN"
    )


@pytest.fixture
def instructor_user(db):
    return User.objects.create_user(
        email=f"ins{_uid()}@sg.test", password="pass", full_name="Instructor User", role="INSTRUCTOR"
    )


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def instructor_client(instructor_user):
    c = APIClient()
    c.force_authenticate(user=instructor_user)
    return c


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(name=f"Group {_uid()}", created_by=admin_user)


@pytest.fixture
def participants(db):
    return [
        User.objects.create_user(
            email=f"p{_uid()}@sg.test", password="pass", full_name=f"Participant {i}", role="PARTICIPANT"
        )
        for i in range(3)
    ]


@pytest.fixture
def group_with_participants(db, group, participants):
    for p in participants:
        GroupMembership.objects.create(group=group, user=p)
    return {"group": group, "participants": participants}


@pytest.fixture
def non_member_user(db):
    return User.objects.create_user(
        email=f"non{_uid()}@sg.test", password="pass", full_name="Non Member", role="PARTICIPANT"
    )


@pytest.fixture
def sub_group(db, group_with_participants, admin_user):
    g = group_with_participants["group"]
    sg = SubGroup.objects.create(parent_group=g, name="Batch A", created_by=admin_user)
    p = group_with_participants["participants"][0]
    SubGroupMembership.objects.create(sub_group=sg, user=p)
    return sg


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubGroupCreate:
    def test_admin_can_create_subgroup(self, admin_client, group_with_participants):
        group = group_with_participants["group"]
        participants = group_with_participants["participants"]
        user_ids = [str(p.id) for p in participants[:2]]

        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/sub-groups",
            {"name": "Batch A", "user_ids": user_ids},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["data"]["name"] == "Batch A"
        assert resp.data["data"]["participants_count"] == 2

    def test_create_with_non_members_fails(self, admin_client, group, non_member_user):
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/sub-groups",
            {"name": "Batch X", "user_ids": [str(non_member_user.id)]},
            format="json",
        )
        assert resp.status_code == 400

    def test_duplicate_name_fails(self, admin_client, sub_group):
        resp = admin_client.post(
            f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups",
            {"name": sub_group.name, "user_ids": []},
            format="json",
        )
        assert resp.status_code == 400

    def test_non_admin_cannot_create(self, instructor_client, group):
        resp = instructor_client.post(
            f"/api/v1/groups/{group.id}/sub-groups",
            {"name": "Batch B", "user_ids": []},
            format="json",
        )
        assert resp.status_code == 403

    def test_create_without_members_succeeds(self, admin_client, group):
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/sub-groups",
            {"name": "Empty Batch"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["data"]["participants_count"] == 0


# ---------------------------------------------------------------------------
# Read / Update / Delete
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubGroupReadUpdateDelete:
    def test_list_sub_groups(self, admin_client, sub_group):
        resp = admin_client.get(f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups")
        assert resp.status_code == 200
        assert len(resp.data["data"]) >= 1

    def test_retrieve_sub_group(self, admin_client, sub_group):
        resp = admin_client.get(
            f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups/{sub_group.id}"
        )
        assert resp.status_code == 200
        assert resp.data["data"]["id"] == str(sub_group.id)

    def test_partial_update_name(self, admin_client, sub_group):
        resp = admin_client.patch(
            f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups/{sub_group.id}",
            {"name": "Renamed Batch"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["data"]["name"] == "Renamed Batch"

    def test_partial_update_members(self, admin_client, sub_group, group_with_participants):
        new_user = group_with_participants["participants"][1]
        resp = admin_client.patch(
            f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups/{sub_group.id}",
            {"user_ids": [str(new_user.id)]},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["data"]["participants_count"] == 1

    def test_delete_sub_group(self, admin_client, sub_group):
        resp = admin_client.delete(
            f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups/{sub_group.id}"
        )
        assert resp.status_code == 204
        assert not SubGroup.objects.filter(pk=sub_group.id).exists()

    def test_non_admin_cannot_delete(self, instructor_client, sub_group):
        resp = instructor_client.delete(
            f"/api/v1/groups/{sub_group.parent_group_id}/sub-groups/{sub_group.id}"
        )
        assert resp.status_code == 403

    def test_retrieve_wrong_group_returns_404(self, db, admin_client, sub_group, admin_user):
        other_group = ClassGroup.objects.create(name=f"Other Group {_uid()}", created_by=admin_user)
        resp = admin_client.get(
            f"/api/v1/groups/{other_group.id}/sub-groups/{sub_group.id}"
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Analytics sub_group_id filter
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAnalyticsSubGroupFilter:
    def test_analytics_without_filter_returns_200(self, admin_client, group):
        resp = admin_client.get(f"/api/v1/groups/{group.id}/analytics")
        assert resp.status_code == 200
        assert "attendance_trend" in resp.data["data"]

    def test_analytics_with_valid_sub_group_id(self, admin_client, sub_group):
        resp = admin_client.get(
            f"/api/v1/groups/{sub_group.parent_group_id}/analytics",
            {"sub_group_id": str(sub_group.id)},
        )
        assert resp.status_code == 200
        assert "attendance_trend" in resp.data["data"]

    def test_analytics_with_invalid_sub_group_id_returns_404(self, admin_client, group):
        resp = admin_client.get(
            f"/api/v1/groups/{group.id}/analytics",
            {"sub_group_id": "00000000-0000-0000-0000-000000000000"},
        )
        assert resp.status_code == 404

    def test_analytics_sub_group_from_other_group_returns_404(self, db, admin_client, sub_group, admin_user):
        other_group = ClassGroup.objects.create(name=f"Other Group {_uid()}", created_by=admin_user)
        resp = admin_client.get(
            f"/api/v1/groups/{other_group.id}/analytics",
            {"sub_group_id": str(sub_group.id)},
        )
        assert resp.status_code == 404
