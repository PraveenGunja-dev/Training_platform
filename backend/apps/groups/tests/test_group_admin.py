"""Tests for GroupAdmin model and API endpoints."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupAdmin

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
        email=f"superadmin{_uid()}@ga.test",
        password="pass",
        full_name="Super Admin",
        role="ADMIN",
    )


@pytest.fixture
def instructor_user(db):
    return User.objects.create_user(
        email=f"instructor{_uid()}@ga.test",
        password="pass",
        full_name="Instructor User",
        role="INSTRUCTOR",
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email=f"participant{_uid()}@ga.test",
        password="pass",
        full_name="Participant User",
        role="PARTICIPANT",
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
    return ClassGroup.objects.create(
        name=f"Test Group {_uid()}", created_by=admin_user
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_assign_group_admin(admin_client, group, instructor_user):
    resp = admin_client.put(
        f"/api/v1/groups/{group.id}/admin",
        {"user_id": str(instructor_user.id)},
        format="json",
    )
    assert resp.status_code == 200
    assert GroupAdmin.objects.filter(group=group, admin=instructor_user).exists()
    assert resp.data["data"]["email"] == instructor_user.email


@pytest.mark.django_db
def test_get_group_admin(admin_client, group, instructor_user, admin_user):
    GroupAdmin.objects.create(group=group, admin=instructor_user, assigned_by=admin_user)
    resp = admin_client.get(f"/api/v1/groups/{group.id}/admin")
    assert resp.status_code == 200
    assert resp.data["data"]["email"] == instructor_user.email


@pytest.mark.django_db
def test_get_group_admin_when_none(admin_client, group):
    resp = admin_client.get(f"/api/v1/groups/{group.id}/admin")
    assert resp.status_code == 200
    assert resp.data["data"] is None


@pytest.mark.django_db
def test_remove_group_admin(admin_client, group, instructor_user, admin_user):
    GroupAdmin.objects.create(group=group, admin=instructor_user, assigned_by=admin_user)
    resp = admin_client.delete(f"/api/v1/groups/{group.id}/admin")
    assert resp.status_code == 204
    assert not GroupAdmin.objects.filter(group=group).exists()


@pytest.mark.django_db
def test_assign_group_admin_is_idempotent(admin_client, group, instructor_user, participant_user, admin_user):
    """Reassigning replaces the previous admin."""
    GroupAdmin.objects.create(group=group, admin=instructor_user, assigned_by=admin_user)
    resp = admin_client.put(
        f"/api/v1/groups/{group.id}/admin",
        {"user_id": str(participant_user.id)},
        format="json",
    )
    assert resp.status_code == 200
    assert GroupAdmin.objects.filter(group=group).count() == 1
    assert GroupAdmin.objects.get(group=group).admin == participant_user


@pytest.mark.django_db
def test_only_super_admin_can_assign(instructor_client, group, instructor_user):
    resp = instructor_client.put(
        f"/api/v1/groups/{group.id}/admin",
        {"user_id": str(instructor_user.id)},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_only_super_admin_can_delete(instructor_client, group, instructor_user, admin_user):
    GroupAdmin.objects.create(group=group, admin=instructor_user, assigned_by=admin_user)
    resp = instructor_client.delete(f"/api/v1/groups/{group.id}/admin")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_only_super_admin_can_get(instructor_client, group):
    resp = instructor_client.get(f"/api/v1/groups/{group.id}/admin")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_me_includes_admin_of_group_ids(instructor_user, group, admin_user):
    GroupAdmin.objects.create(group=group, admin=instructor_user, assigned_by=admin_user)
    c = APIClient()
    c.force_authenticate(user=instructor_user)
    resp = c.get("/api/v1/me")
    assert resp.status_code == 200
    assert str(group.id) in resp.data["data"]["admin_of_group_ids"]


@pytest.mark.django_db
def test_me_admin_of_group_ids_empty_when_not_admin(instructor_user):
    c = APIClient()
    c.force_authenticate(user=instructor_user)
    resp = c.get("/api/v1/me")
    assert resp.status_code == 200
    assert resp.data["data"]["admin_of_group_ids"] == []


@pytest.mark.django_db
def test_assign_invalid_user_id(admin_client, group):
    import uuid
    resp = admin_client.put(
        f"/api/v1/groups/{group.id}/admin",
        {"user_id": str(uuid.uuid4())},
        format="json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Permission tests — Group Admin can manage their own group
# ---------------------------------------------------------------------------


@pytest.fixture
def group_admin_user(db):
    return User.objects.create_user(
        email=f"groupadmin{_uid()}@ga.test",
        password="pass",
        full_name="Group Admin User",
        role="PARTICIPANT",
    )


@pytest.fixture
def other_group(db, admin_user):
    return ClassGroup.objects.create(
        name=f"Other Group {_uid()}", created_by=admin_user
    )


@pytest.fixture
def ga_client(group_admin_user, group, admin_user):
    """Client authenticated as a Group Admin of `group`."""
    GroupAdmin.objects.create(group=group, admin=group_admin_user, assigned_by=admin_user)
    c = APIClient()
    c.force_authenticate(user=group_admin_user)
    return c


@pytest.mark.django_db
def test_group_admin_can_list_includes_their_group(ga_client, group):
    resp = ga_client.get("/api/v1/groups")
    assert resp.status_code == 200
    ids = [g["id"] for g in resp.data["data"]]
    assert str(group.id) in ids


@pytest.mark.django_db
def test_group_admin_can_read_group_detail(ga_client, group):
    resp = ga_client.get(f"/api/v1/groups/{group.id}")
    assert resp.status_code == 200
    assert resp.data["data"]["id"] == str(group.id)


@pytest.mark.django_db
def test_group_admin_cannot_read_other_group(group_admin_user, other_group):
    c = APIClient()
    c.force_authenticate(user=group_admin_user)
    resp = c.get(f"/api/v1/groups/{other_group.id}")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_group_admin_can_add_participants(ga_client, group, participant_user):
    resp = ga_client.post(
        f"/api/v1/groups/{group.id}/participants",
        {"user_ids": [str(participant_user.id)]},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_group_admin_cannot_add_participants_to_other_group(ga_client, other_group, participant_user):
    resp = ga_client.post(
        f"/api/v1/groups/{other_group.id}/participants",
        {"user_ids": [str(participant_user.id)]},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_group_admin_can_assign_instructor(ga_client, group, instructor_user):
    resp = ga_client.post(
        f"/api/v1/groups/{group.id}/instructors",
        {"user_ids": [str(instructor_user.id)]},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_group_admin_can_remove_instructor(ga_client, group, instructor_user, admin_user):
    from apps.groups.models import GroupInstructor
    GroupInstructor.objects.create(group=group, instructor=instructor_user, assigned_by=admin_user)
    resp = ga_client.delete(f"/api/v1/groups/{group.id}/instructors/{instructor_user.id}")
    assert resp.status_code == 204


@pytest.mark.django_db
def test_group_admin_can_read_instructors_list(ga_client, group):
    resp = ga_client.get(f"/api/v1/groups/{group.id}/instructors")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_group_admin_can_read_analytics(ga_client, group):
    resp = ga_client.get(f"/api/v1/groups/{group.id}/analytics")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_group_admin_can_create_sub_group(ga_client, group):
    resp = ga_client.post(
        f"/api/v1/groups/{group.id}/sub-groups",
        {"name": "Section A", "user_ids": []},
        format="json",
    )
    assert resp.status_code == 201


@pytest.mark.django_db
def test_group_admin_cannot_create_sub_group_in_other_group(ga_client, other_group):
    resp = ga_client.post(
        f"/api/v1/groups/{other_group.id}/sub-groups",
        {"name": "Sneaky Section", "user_ids": []},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_group_admin_cannot_assign_instructor_to_other_group(ga_client, other_group, instructor_user):
    resp = ga_client.post(
        f"/api/v1/groups/{other_group.id}/instructors",
        {"user_ids": [str(instructor_user.id)]},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_group_admin_cannot_remove_participant_from_other_group(ga_client, other_group, participant_user):
    from apps.groups.models import GroupMembership
    GroupMembership.objects.create(group=other_group, user=participant_user)
    resp = ga_client.delete(f"/api/v1/groups/{other_group.id}/participants/{participant_user.id}")
    assert resp.status_code == 403
