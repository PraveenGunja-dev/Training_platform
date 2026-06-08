import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.groups.models import ClassGroup, GroupMembership

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@g.test", password="pass", full_name="Admin User", role="ADMIN"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@g.test", password="pass", full_name="Part User", role="PARTICIPANT"
    )


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def participant_client(participant_user):
    c = APIClient()
    c.force_authenticate(user=participant_user)
    return c


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(
        name="Batch Alpha", description="Test group", created_by=admin_user
    )


# ---------------------------------------------------------------------------
# Admin CRUD
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAdminGroupCRUD:
    def test_admin_create_group(self, admin_client):
        resp = admin_client.post(
            "/api/v1/groups",
            {"name": "New Group", "description": "Desc"},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["name"] == "New Group"
        assert data["is_archived"] is False
        assert "participants" in data

    def test_admin_list_all_groups(self, admin_client, group):
        resp = admin_client.get("/api/v1/groups")
        assert resp.status_code == 200
        names = [g["name"] for g in resp.json()["data"]]
        assert "Batch Alpha" in names

    def test_admin_retrieve_group_embeds_participants(self, admin_client, group, participant_user):
        GroupMembership.objects.create(group=group, user=participant_user)
        resp = admin_client.get(f"/api/v1/groups/{group.id}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "participants" in data
        assert len(data["participants"]) == 1
        p = data["participants"][0]
        assert "id" in p
        assert "full_name" in p
        assert "email" in p

    def test_admin_patch_group_name(self, admin_client, group):
        resp = admin_client.patch(
            f"/api/v1/groups/{group.id}",
            {"name": "Renamed Group"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Renamed Group"

    def test_admin_patch_writes_audit(self, admin_client, group):
        admin_client.patch(
            f"/api/v1/groups/{group.id}", {"name": "Patched"}, format="json"
        )
        assert AuditLog.objects.filter(action="group.updated").exists()

    def test_admin_delete_soft_deletes_group(self, admin_client, group):
        resp = admin_client.delete(f"/api/v1/groups/{group.id}")
        assert resp.status_code == 204
        group.refresh_from_db()
        assert group.is_archived is True

    def test_admin_delete_writes_audit(self, admin_client, group):
        admin_client.delete(f"/api/v1/groups/{group.id}")
        assert AuditLog.objects.filter(action="group.archived").exists()

    def test_admin_create_writes_audit(self, admin_client):
        admin_client.post(
            "/api/v1/groups", {"name": "AuditGroup"}, format="json"
        )
        assert AuditLog.objects.filter(action="group.created").exists()

    def test_archived_excluded_from_list_by_default(self, admin_client, admin_user):
        ClassGroup.objects.create(name="Hidden", is_archived=True, created_by=admin_user)
        resp = admin_client.get("/api/v1/groups")
        names = [g["name"] for g in resp.json()["data"]]
        assert "Hidden" not in names

    def test_include_archived_true_shows_archived(self, admin_client, admin_user):
        ClassGroup.objects.create(name="Archived", is_archived=True, created_by=admin_user)
        resp = admin_client.get("/api/v1/groups?include_archived=true")
        names = [g["name"] for g in resp.json()["data"]]
        assert "Archived" in names

    def test_retrieve_nonexistent_group_404(self, admin_client):
        resp = admin_client.get(f"/api/v1/groups/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Participant scoping
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestParticipantScoping:
    def test_participant_list_only_member_groups(self, participant_client, participant_user, admin_user):
        my_group = ClassGroup.objects.create(name="My Group", created_by=admin_user)
        ClassGroup.objects.create(name="Other Group", created_by=admin_user)
        GroupMembership.objects.create(group=my_group, user=participant_user)

        resp = participant_client.get("/api/v1/groups")
        assert resp.status_code == 200
        names = [g["name"] for g in resp.json()["data"]]
        assert "My Group" in names
        assert "Other Group" not in names

    def test_participant_sees_empty_list_when_no_memberships(self, participant_client, admin_user):
        ClassGroup.objects.create(name="Some Group", created_by=admin_user)
        resp = participant_client.get("/api/v1/groups")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_participant_cannot_create_group(self, participant_client):
        resp = participant_client.post("/api/v1/groups", {"name": "Hack"}, format="json")
        assert resp.status_code == 403
        assert "errors" in resp.json()

    def test_participant_cannot_patch_group(self, participant_client, group):
        resp = participant_client.patch(
            f"/api/v1/groups/{group.id}", {"name": "Hack"}, format="json"
        )
        assert resp.status_code == 403

    def test_participant_cannot_delete_group(self, participant_client, group):
        resp = participant_client.delete(f"/api/v1/groups/{group.id}")
        assert resp.status_code == 403

    def test_participant_cannot_retrieve_non_member_group(self, participant_client, group):
        resp = participant_client.get(f"/api/v1/groups/{group.id}")
        assert resp.status_code == 403

    def test_participant_can_retrieve_own_group(self, participant_client, participant_user, group):
        GroupMembership.objects.create(group=group, user=participant_user)
        resp = participant_client.get(f"/api/v1/groups/{group.id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Batch Alpha"


# ---------------------------------------------------------------------------
# Bulk add participants
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestBulkAddParticipants:
    def _make_participants(self, n: int) -> list:
        return [
            User.objects.create_user(
                email=f"bp{i}@test.com",
                password="pass",
                full_name=f"BP{i}",
                role="PARTICIPANT",
            )
            for i in range(n)
        ]

    def test_bulk_add_5_new_5_dupes(self, admin_client, group):
        users = self._make_participants(10)
        for u in users[:5]:
            GroupMembership.objects.create(group=group, user=u)

        all_ids = [str(u.id) for u in users]
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/participants",
            {"user_ids": all_ids},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["added"]) == 5
        assert len(data["skipped"]) == 5

    def test_bulk_add_writes_audit_entry(self, admin_client, group):
        user = User.objects.create_user(
            email="audit@bulk.test", password="pass", full_name="AuditBulk", role="PARTICIPANT"
        )
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/participants",
            {"user_ids": [str(user.id)]},
            format="json",
        )
        assert resp.status_code == 200
        assert AuditLog.objects.filter(action="group.participants_added").exists()
        entry = AuditLog.objects.get(action="group.participants_added")
        assert str(user.id) in entry.metadata["added"]

    def test_bulk_add_empty_user_ids_returns_400(self, admin_client, group):
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/participants",
            {"user_ids": []},
            format="json",
        )
        assert resp.status_code == 400

    def test_bulk_add_requires_admin(self, participant_client, group):
        resp = participant_client.post(
            f"/api/v1/groups/{group.id}/participants",
            {"user_ids": [str(uuid.uuid4())]},
            format="json",
        )
        assert resp.status_code == 403

    def test_bulk_add_nonexistent_users_are_skipped(self, admin_client, group):
        fake_ids = [str(uuid.uuid4()) for _ in range(3)]
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/participants",
            {"user_ids": fake_ids},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["added"]) == 0
        assert len(data["skipped"]) == 3


# ---------------------------------------------------------------------------
# Remove participant
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRemoveParticipant:
    def test_admin_can_remove_participant(self, admin_client, group, participant_user):
        GroupMembership.objects.create(group=group, user=participant_user)
        resp = admin_client.delete(
            f"/api/v1/groups/{group.id}/participants/{participant_user.id}"
        )
        assert resp.status_code == 204
        assert not GroupMembership.objects.filter(group=group, user=participant_user).exists()

    def test_remove_participant_writes_audit(self, admin_client, group, participant_user):
        GroupMembership.objects.create(group=group, user=participant_user)
        admin_client.delete(
            f"/api/v1/groups/{group.id}/participants/{participant_user.id}"
        )
        assert AuditLog.objects.filter(action="group.participant_removed").exists()

    def test_remove_nonexistent_member_is_no_op(self, admin_client, group):
        resp = admin_client.delete(
            f"/api/v1/groups/{group.id}/participants/{uuid.uuid4()}"
        )
        assert resp.status_code == 204

    def test_remove_participant_requires_admin(self, participant_client, group, participant_user):
        GroupMembership.objects.create(group=group, user=participant_user)
        resp = participant_client.delete(
            f"/api/v1/groups/{group.id}/participants/{participant_user.id}"
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Unauthenticated guard
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unauthenticated_list_returns_401():
    c = APIClient()
    resp = c.get("/api/v1/groups")
    assert resp.status_code == 401
