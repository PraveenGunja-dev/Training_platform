"""Chunk 02 — Instructor scoping tests for the assignments app."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.assignments.models import AssignmentTask, Submission
from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership

User = get_user_model()

NOW = timezone.now()
OPEN_AT = NOW - timedelta(hours=1)
DEADLINE = NOW + timedelta(days=7)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin@asgn.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def instructor(db):
    return User.objects.create_user(email="ins@asgn.s.test", password="pass", full_name="Instructor", role="INSTRUCTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@asgn.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


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
def participant_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def group_a(db, admin):
    return ClassGroup.objects.create(name="Asgn Group A", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Asgn Group B", created_by=admin)


@pytest.fixture
def assigned(group_a, instructor, admin):
    return GroupInstructor.objects.create(group=group_a, instructor=instructor, assigned_by=admin)


@pytest.fixture
def task_a(db, group_a, admin):
    return AssignmentTask.objects.create(
        group=group_a,
        title="Task in A",
        description="desc",
        upload_open_at=OPEN_AT,
        deadline_at=DEADLINE,
        is_open=True,
        created_by=admin,
    )


@pytest.fixture
def task_b(db, group_b, admin):
    return AssignmentTask.objects.create(
        group=group_b,
        title="Task in B",
        description="desc",
        upload_open_at=OPEN_AT,
        deadline_at=DEADLINE,
        is_open=True,
        created_by=admin,
    )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssignmentList:
    def test_admin_sees_all_tasks(self, admin_client, task_a, task_b):
        resp = admin_client.get("/api/v1/assignments")
        assert resp.status_code == 200
        titles = {t["title"] for t in resp.json()["data"]}
        assert "Task in A" in titles
        assert "Task in B" in titles

    def test_instructor_no_assignment_sees_empty(self, instructor_client, task_a):
        resp = instructor_client.get("/api/v1/assignments")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_instructor_assigned_sees_only_own_tasks(self, instructor_client, assigned, task_a, task_b):
        resp = instructor_client.get("/api/v1/assignments")
        assert resp.status_code == 200
        titles = {t["title"] for t in resp.json()["data"]}
        assert "Task in A" in titles
        assert "Task in B" not in titles


# ---------------------------------------------------------------------------
# Retrieve
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssignmentRetrieve:
    def test_instructor_retrieves_assigned_task(self, instructor_client, assigned, task_a):
        resp = instructor_client.get(f"/api/v1/assignments/{task_a.id}")
        assert resp.status_code == 200

    def test_instructor_cannot_retrieve_unassigned_task(self, instructor_client, task_b):
        resp = instructor_client.get(f"/api/v1/assignments/{task_b.id}")
        assert resp.status_code == 403
        assert resp.json()["errors"][0]["code"] == "perm.not_instructor_of_group"


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssignmentCreate:
    def _task_payload(self, group_id):
        return {
            "group_id": str(group_id),
            "title": "New Task",
            "question": "What is X?",
            "description": "desc",
            "upload_open_at": OPEN_AT.isoformat(),
            "deadline_at": DEADLINE.isoformat(),
        }

    def test_instructor_can_create_task_in_assigned_group(self, instructor_client, assigned, group_a):
        resp = instructor_client.post("/api/v1/assignments", self._task_payload(group_a.id), format="json")
        assert resp.status_code == 201

    def test_instructor_cannot_create_task_in_unassigned_group(self, instructor_client, group_b):
        resp = instructor_client.post("/api/v1/assignments", self._task_payload(group_b.id), format="json")
        assert resp.status_code == 403

    def test_participant_cannot_create_task(self, participant_client, group_a):
        resp = participant_client.post("/api/v1/assignments", self._task_payload(group_a.id), format="json")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update / Delete
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssignmentWriteScoping:
    def test_instructor_can_update_task_in_assigned_group(self, instructor_client, assigned, task_a):
        resp = instructor_client.patch(
            f"/api/v1/assignments/{task_a.id}",
            {"title": "Updated Task"},
            format="json",
        )
        assert resp.status_code == 200

    def test_instructor_cannot_update_task_in_unassigned_group(self, instructor_client, task_b):
        resp = instructor_client.patch(
            f"/api/v1/assignments/{task_b.id}",
            {"title": "Hacked"},
            format="json",
        )
        assert resp.status_code == 403

    def test_instructor_can_delete_task_in_assigned_group(self, instructor_client, assigned, task_a):
        resp = instructor_client.delete(f"/api/v1/assignments/{task_a.id}")
        assert resp.status_code == 204

    def test_instructor_cannot_delete_task_in_unassigned_group(self, instructor_client, task_b):
        resp = instructor_client.delete(f"/api/v1/assignments/{task_b.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Close
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestAssignmentClose:
    def test_instructor_can_close_task_in_assigned_group(self, instructor_client, assigned, task_a):
        resp = instructor_client.post(f"/api/v1/assignments/{task_a.id}/close")
        assert resp.status_code == 200

    def test_instructor_cannot_close_task_in_unassigned_group(self, instructor_client, task_b):
        resp = instructor_client.post(f"/api/v1/assignments/{task_b.id}/close")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# List submissions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestListSubmissions:
    def test_instructor_can_list_submissions_for_assigned_task(self, instructor_client, assigned, task_a):
        resp = instructor_client.get(f"/api/v1/assignments/{task_a.id}/submissions")
        assert resp.status_code == 200

    def test_instructor_cannot_list_submissions_for_unassigned_task(self, instructor_client, task_b):
        resp = instructor_client.get(f"/api/v1/assignments/{task_b.id}/submissions")
        assert resp.status_code == 403
