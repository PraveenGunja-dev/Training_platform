"""Chunk 03 — tests for new instructor-management endpoints.

Covers:
  GET  /groups/{id}/instructors        — list instructors (permission matrix)
  POST /groups/{id}/instructors        — bulk assign
  DELETE /groups/{id}/instructors/{uid} — unassign
  GET  /instructors                    — picker list (admin, ?q= filter)
  GET  /me/groups                      — instructor's own assigned groups
  PATCH /admin/settings                — instructors_can_view_all_classes + audit
  PATCH /users/{id}/visibility         — per-instructor override + audit
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.common.models import SystemSettings
from apps.groups.models import ClassGroup, GroupInstructor

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email="admin@ep.test", password="pass", full_name="Admin User", role="ADMIN"
    )


@pytest.fixture
def instructor(db):
    return User.objects.create_user(
        email="ins@ep.test", password="pass", full_name="Jane Instructor", role="INSTRUCTOR"
    )


@pytest.fixture
def instructor2(db):
    return User.objects.create_user(
        email="ins2@ep.test", password="pass", full_name="Bob Instructor", role="INSTRUCTOR"
    )


@pytest.fixture
def participant(db):
    return User.objects.create_user(
        email="part@ep.test", password="pass", full_name="Part User", role="PARTICIPANT"
    )


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def instructor_client(instructor):
    c = APIClient()
    c.force_authenticate(user=instructor)
    return c


@pytest.fixture
def instructor2_client(instructor2):
    c = APIClient()
    c.force_authenticate(user=instructor2)
    return c


@pytest.fixture
def participant_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def group(db, admin):
    return ClassGroup.objects.create(name="Alpha Group", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Beta Group", created_by=admin)


@pytest.fixture
def assignment(group, instructor, admin):
    """Instructor assigned to group."""
    return GroupInstructor.objects.create(group=group, instructor=instructor, assigned_by=admin)


# ---------------------------------------------------------------------------
# GET /groups/{id}/instructors — permission matrix
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListGroupInstructors:
    def test_admin_can_list_instructors(self, admin_client, group, assignment):
        resp = admin_client.get(f"/api/v1/groups/{group.id}/instructors")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["email"] == "ins@ep.test"
        assert "assigned_at" in data[0]

    def test_instructor_of_group_can_list(self, instructor_client, group, assignment):
        resp = instructor_client.get(f"/api/v1/groups/{group.id}/instructors")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    def test_instructor_elsewhere_gets_403(self, instructor2_client, group, assignment):
        # instructor2 is NOT assigned to group
        resp = instructor2_client.get(f"/api/v1/groups/{group.id}/instructors")
        assert resp.status_code == 403

    def test_participant_gets_403(self, participant_client, group, assignment):
        resp = participant_client.get(f"/api/v1/groups/{group.id}/instructors")
        assert resp.status_code == 403

    def test_empty_list_when_no_instructors(self, admin_client, group):
        resp = admin_client.get(f"/api/v1/groups/{group.id}/instructors")
        assert resp.status_code == 200
        assert resp.json()["data"] == []


# ---------------------------------------------------------------------------
# POST /groups/{id}/instructors — bulk assign
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssignInstructors:
    def test_admin_assigns_multiple_instructors(self, admin_client, admin, group, instructor, instructor2):
        payload = {"user_ids": [str(instructor.id), str(instructor2.id)]}
        resp = admin_client.post(f"/api/v1/groups/{group.id}/instructors", payload, format="json")
        assert resp.status_code == 200
        assert resp.json()["data"]["assigned"] == 2
        assert resp.json()["data"]["skipped"] == 0
        assert GroupInstructor.objects.filter(group=group).count() == 2

    def test_assign_emits_audit_per_new_instructor(self, admin_client, group, instructor, instructor2):
        payload = {"user_ids": [str(instructor.id), str(instructor2.id)]}
        admin_client.post(f"/api/v1/groups/{group.id}/instructors", payload, format="json")
        audit_rows = AuditLog.objects.filter(action="instructor_assigned")
        assert audit_rows.count() == 2
        meta = audit_rows.first().metadata
        assert meta["group_id"] == str(group.id)
        assert meta["group_title"] == group.name

    def test_participant_user_id_returns_400(self, admin_client, group, participant):
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/instructors",
            {"user_ids": [str(participant.id)]},
            format="json",
        )
        assert resp.status_code == 400
        assert "INSTRUCTOR" in str(resp.json())

    def test_duplicate_assign_is_idempotent(self, admin_client, group, instructor, assignment):
        # assignment fixture already created one GroupInstructor row
        resp = admin_client.post(
            f"/api/v1/groups/{group.id}/instructors",
            {"user_ids": [str(instructor.id)]},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["assigned"] == 0
        assert resp.json()["data"]["skipped"] == 1
        assert GroupInstructor.objects.filter(group=group, instructor=instructor).count() == 1

    def test_instructor_cannot_assign(self, instructor_client, group, instructor2):
        resp = instructor_client.post(
            f"/api/v1/groups/{group.id}/instructors",
            {"user_ids": [str(instructor2.id)]},
            format="json",
        )
        assert resp.status_code == 403

    def test_participant_cannot_assign(self, participant_client, group, instructor):
        resp = participant_client.post(
            f"/api/v1/groups/{group.id}/instructors",
            {"user_ids": [str(instructor.id)]},
            format="json",
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /groups/{id}/instructors/{user_id} — unassign
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUnassignInstructor:
    def test_admin_unassigns_instructor(self, admin_client, group, instructor, assignment):
        resp = admin_client.delete(f"/api/v1/groups/{group.id}/instructors/{instructor.id}")
        assert resp.status_code == 204
        assert not GroupInstructor.objects.filter(group=group, instructor=instructor).exists()

    def test_unassign_emits_audit(self, admin_client, group, instructor, assignment):
        admin_client.delete(f"/api/v1/groups/{group.id}/instructors/{instructor.id}")
        row = AuditLog.objects.filter(action="instructor_unassigned").first()
        assert row is not None
        assert row.metadata["group_id"] == str(group.id)

    def test_unassign_nonexistent_returns_404(self, admin_client, group, instructor2):
        # instructor2 is not assigned to group
        resp = admin_client.delete(f"/api/v1/groups/{group.id}/instructors/{instructor2.id}")
        assert resp.status_code == 404

    def test_instructor_cannot_unassign(self, instructor_client, group, instructor2, admin):
        GroupInstructor.objects.create(group=group, instructor=instructor2, assigned_by=admin)
        resp = instructor_client.delete(f"/api/v1/groups/{group.id}/instructors/{instructor2.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /instructors — picker list
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInstructorListView:
    def test_returns_only_instructors(self, admin_client, instructor, instructor2, participant):
        resp = admin_client.get("/api/v1/instructors")
        assert resp.status_code == 200
        emails = {u["email"] for u in resp.json()["data"]}
        assert "ins@ep.test" in emails
        assert "ins2@ep.test" in emails
        assert "part@ep.test" not in emails

    def test_q_filter_by_name(self, admin_client, instructor, instructor2):
        # "Jane" matches instructor (full_name="Jane Instructor"), not instructor2
        resp = admin_client.get("/api/v1/instructors?q=Jane")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["email"] == "ins@ep.test"

    def test_q_filter_by_email(self, admin_client, instructor, instructor2):
        resp = admin_client.get("/api/v1/instructors?q=ins2")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["email"] == "ins2@ep.test"

    def test_participant_gets_403(self, participant_client):
        resp = participant_client.get("/api/v1/instructors")
        assert resp.status_code == 403

    def test_instructor_gets_403(self, instructor_client):
        resp = instructor_client.get("/api/v1/instructors")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /me/groups
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeGroupsView:
    def test_empty_when_no_assignments(self, instructor_client):
        resp = instructor_client.get("/api/v1/me/groups")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_returns_assigned_groups_only(self, instructor_client, instructor, admin, group, group_b):
        GroupInstructor.objects.create(group=group, instructor=instructor, assigned_by=admin)
        # group_b is NOT assigned
        resp = instructor_client.get("/api/v1/me/groups")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["name"] == "Alpha Group"
        assert "participant_count" in data[0]

    def test_admin_gets_403(self, admin_client):
        resp = admin_client.get("/api/v1/me/groups")
        assert resp.status_code == 403

    def test_participant_gets_403(self, participant_client):
        resp = participant_client.get("/api/v1/me/groups")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /admin/settings — instructors_can_view_all_classes
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSettingsVisibilityPatch:
    def test_update_flag_to_true(self, admin_client):
        resp = admin_client.patch(
            "/api/v1/admin/settings",
            {"instructors_can_view_all_classes": True},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["instructors_can_view_all_classes"] is True
        assert SystemSettings.get_solo().instructors_can_view_all_classes is True

    def test_update_flag_emits_audit(self, admin_client):
        admin_client.patch(
            "/api/v1/admin/settings",
            {"instructors_can_view_all_classes": True},
            format="json",
        )
        row = AuditLog.objects.filter(action="instructor_visibility_changed").first()
        assert row is not None
        assert row.metadata["scope"] == "system"
        assert row.metadata["old"] is False
        assert row.metadata["new"] is True

    def test_no_audit_when_value_unchanged(self, admin_client):
        # Default is False; patching with False should not emit audit
        admin_client.patch(
            "/api/v1/admin/settings",
            {"instructors_can_view_all_classes": False},
            format="json",
        )
        assert AuditLog.objects.filter(action="instructor_visibility_changed").count() == 0

    def test_instructor_cannot_patch_settings(self, instructor_client):
        resp = instructor_client.patch(
            "/api/v1/admin/settings",
            {"instructors_can_view_all_classes": True},
            format="json",
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /users/{id}/visibility
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUserVisibilityPatch:
    def test_set_to_true(self, admin_client, instructor):
        resp = admin_client.patch(
            f"/api/v1/users/{instructor.id}/visibility",
            {"can_view_all_classes": True},
            format="json",
        )
        assert resp.status_code == 200
        instructor.refresh_from_db()
        assert instructor.can_view_all_classes is True

    def test_set_to_false(self, admin_client, instructor):
        resp = admin_client.patch(
            f"/api/v1/users/{instructor.id}/visibility",
            {"can_view_all_classes": False},
            format="json",
        )
        assert resp.status_code == 200
        instructor.refresh_from_db()
        assert instructor.can_view_all_classes is False

    def test_set_to_null_inherits_system(self, admin_client, instructor):
        instructor.can_view_all_classes = True
        instructor.save()
        resp = admin_client.patch(
            f"/api/v1/users/{instructor.id}/visibility",
            {"can_view_all_classes": None},
            format="json",
        )
        assert resp.status_code == 200
        instructor.refresh_from_db()
        assert instructor.can_view_all_classes is None

    def test_400_when_target_is_not_instructor(self, admin_client, participant):
        resp = admin_client.patch(
            f"/api/v1/users/{participant.id}/visibility",
            {"can_view_all_classes": True},
            format="json",
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "user.not_instructor"

    def test_audit_emitted_with_old_and_new(self, admin_client, instructor):
        instructor.can_view_all_classes = False
        instructor.save()
        admin_client.patch(
            f"/api/v1/users/{instructor.id}/visibility",
            {"can_view_all_classes": True},
            format="json",
        )
        row = AuditLog.objects.filter(action="instructor_visibility_changed").first()
        assert row is not None
        assert row.metadata["scope"] == "user"
        assert row.metadata["old"] is False
        assert row.metadata["new"] is True

    def test_instructor_cannot_call_visibility_endpoint(self, instructor_client, instructor2):
        resp = instructor_client.patch(
            f"/api/v1/users/{instructor2.id}/visibility",
            {"can_view_all_classes": True},
            format="json",
        )
        assert resp.status_code == 403

    def test_participant_cannot_call_visibility_endpoint(self, participant_client, instructor):
        resp = participant_client.patch(
            f"/api/v1/users/{instructor.id}/visibility",
            {"can_view_all_classes": True},
            format="json",
        )
        assert resp.status_code == 403
