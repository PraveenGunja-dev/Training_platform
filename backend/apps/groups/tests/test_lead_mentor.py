"""Tests for GroupLeadMentor model and API endpoints."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.groups.models import ClassGroup, GroupLeadMentor

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
        role="SUB_MENTOR",
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
def test_assign_lead_mentor(admin_client, group, instructor_user):
    resp = admin_client.put(
        f"/training/api/v1/groups/{group.id}/lead-mentor",
        {"user_id": str(instructor_user.id)},
        format="json",
    )
    assert resp.status_code == 200
    assert GroupLeadMentor.objects.filter(group=group, lead_mentor=instructor_user).exists()
    assert resp.data["data"]["email"] == instructor_user.email


@pytest.mark.django_db
def test_get_lead_mentor(admin_client, group, instructor_user, admin_user):
    GroupLeadMentor.objects.create(group=group, lead_mentor=instructor_user, assigned_by=admin_user)
    resp = admin_client.get(f"/training/api/v1/groups/{group.id}/lead-mentor")
    assert resp.status_code == 200
    assert resp.data["data"]["email"] == instructor_user.email


@pytest.mark.django_db
def test_get_lead_mentor_when_none(admin_client, group):
    resp = admin_client.get(f"/training/api/v1/groups/{group.id}/lead-mentor")
    assert resp.status_code == 200
    assert resp.data["data"] is None


@pytest.mark.django_db
def test_remove_lead_mentor(admin_client, group, instructor_user, admin_user):
    GroupLeadMentor.objects.create(group=group, lead_mentor=instructor_user, assigned_by=admin_user)
    resp = admin_client.delete(f"/training/api/v1/groups/{group.id}/lead-mentor")
    assert resp.status_code == 204
    assert not GroupLeadMentor.objects.filter(group=group).exists()


@pytest.mark.django_db
def test_assign_lead_mentor_is_idempotent(admin_client, group, instructor_user, participant_user, admin_user):
    """Reassigning replaces the previous admin."""
    GroupLeadMentor.objects.create(group=group, lead_mentor=instructor_user, assigned_by=admin_user)
    resp = admin_client.put(
        f"/training/api/v1/groups/{group.id}/lead-mentor",
        {"user_id": str(participant_user.id)},
        format="json",
    )
    assert resp.status_code == 200
    assert GroupLeadMentor.objects.filter(group=group).count() == 1
    assert GroupLeadMentor.objects.get(group=group).lead_mentor == participant_user


@pytest.mark.django_db
def test_only_super_admin_can_assign(instructor_client, group, instructor_user):
    resp = instructor_client.put(
        f"/training/api/v1/groups/{group.id}/lead-mentor",
        {"user_id": str(instructor_user.id)},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_only_super_admin_can_delete(instructor_client, group, instructor_user, admin_user):
    GroupLeadMentor.objects.create(group=group, lead_mentor=instructor_user, assigned_by=admin_user)
    resp = instructor_client.delete(f"/training/api/v1/groups/{group.id}/lead-mentor")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_only_super_admin_can_get(instructor_client, group):
    resp = instructor_client.get(f"/training/api/v1/groups/{group.id}/lead-mentor")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_me_includes_lead_mentor_of_group_ids(instructor_user, group, admin_user):
    GroupLeadMentor.objects.create(group=group, lead_mentor=instructor_user, assigned_by=admin_user)
    c = APIClient()
    c.force_authenticate(user=instructor_user)
    resp = c.get("/training/api/v1/me")
    assert resp.status_code == 200
    assert str(group.id) in resp.data["data"]["lead_mentor_of_group_ids"]


@pytest.mark.django_db
def test_me_lead_mentor_of_group_ids_empty_when_not_admin(instructor_user):
    c = APIClient()
    c.force_authenticate(user=instructor_user)
    resp = c.get("/training/api/v1/me")
    assert resp.status_code == 200
    assert resp.data["data"]["lead_mentor_of_group_ids"] == []


@pytest.mark.django_db
def test_assign_invalid_user_id(admin_client, group):
    import uuid
    resp = admin_client.put(
        f"/training/api/v1/groups/{group.id}/lead-mentor",
        {"user_id": str(uuid.uuid4())},
        format="json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Permission tests — Group Admin can manage their own group
# ---------------------------------------------------------------------------


@pytest.fixture
def lead_mentor_user(db):
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
def ga_client(lead_mentor_user, group, admin_user):
    """Client authenticated as a Group Admin of `group`."""
    GroupLeadMentor.objects.create(group=group, lead_mentor=lead_mentor_user, assigned_by=admin_user)
    c = APIClient()
    c.force_authenticate(user=lead_mentor_user)
    return c


@pytest.mark.django_db
def test_lead_mentor_can_list_includes_their_group(ga_client, group):
    resp = ga_client.get("/training/api/v1/groups")
    assert resp.status_code == 200
    ids = [g["id"] for g in resp.data["data"]]
    assert str(group.id) in ids


@pytest.mark.django_db
def test_lead_mentor_can_read_group_detail(ga_client, group):
    resp = ga_client.get(f"/training/api/v1/groups/{group.id}")
    assert resp.status_code == 200
    assert resp.data["data"]["id"] == str(group.id)


@pytest.mark.django_db
def test_lead_mentor_cannot_read_other_group(lead_mentor_user, other_group):
    c = APIClient()
    c.force_authenticate(user=lead_mentor_user)
    resp = c.get(f"/training/api/v1/groups/{other_group.id}")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_lead_mentor_can_add_participants(ga_client, group, participant_user):
    resp = ga_client.post(
        f"/training/api/v1/groups/{group.id}/participants",
        {"user_ids": [str(participant_user.id)]},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_lead_mentor_cannot_add_participants_to_other_group(ga_client, other_group, participant_user):
    resp = ga_client.post(
        f"/training/api/v1/groups/{other_group.id}/participants",
        {"user_ids": [str(participant_user.id)]},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_lead_mentor_can_assign_instructor(ga_client, group, instructor_user):
    resp = ga_client.post(
        f"/training/api/v1/groups/{group.id}/sub-mentors",
        {"user_ids": [str(instructor_user.id)]},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_lead_mentor_can_remove_instructor(ga_client, group, instructor_user, admin_user):
    from apps.groups.models import GroupSubMentor
    GroupSubMentor.objects.create(group=group, sub_mentor=instructor_user, assigned_by=admin_user)
    resp = ga_client.delete(f"/training/api/v1/groups/{group.id}/sub-mentors/{instructor_user.id}")
    assert resp.status_code == 204


@pytest.mark.django_db
def test_lead_mentor_can_read_instructors_list(ga_client, group):
    resp = ga_client.get(f"/training/api/v1/groups/{group.id}/sub-mentors")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_lead_mentor_can_read_analytics(ga_client, group):
    resp = ga_client.get(f"/training/api/v1/groups/{group.id}/analytics")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_lead_mentor_can_create_sub_group(ga_client, group):
    resp = ga_client.post(
        f"/training/api/v1/groups/{group.id}/sub-groups",
        {"name": "Section A", "user_ids": []},
        format="json",
    )
    assert resp.status_code == 201


@pytest.mark.django_db
def test_lead_mentor_cannot_create_sub_group_in_other_group(ga_client, other_group):
    resp = ga_client.post(
        f"/training/api/v1/groups/{other_group.id}/sub-groups",
        {"name": "Sneaky Section", "user_ids": []},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_lead_mentor_cannot_assign_instructor_to_other_group(ga_client, other_group, instructor_user):
    resp = ga_client.post(
        f"/training/api/v1/groups/{other_group.id}/sub-mentors",
        {"user_ids": [str(instructor_user.id)]},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_lead_mentor_cannot_remove_participant_from_other_group(ga_client, other_group, participant_user):
    from apps.groups.models import GroupMembership
    GroupMembership.objects.create(group=other_group, user=participant_user)
    resp = ga_client.delete(f"/training/api/v1/groups/{other_group.id}/participants/{participant_user.id}")
    assert resp.status_code == 403
