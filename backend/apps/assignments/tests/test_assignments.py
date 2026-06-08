"""Tests for the assignments app (B-06).

Covers:
- AssignmentTask CRUD (Admin only create/update/delete)
- Participant list scoping (only open tasks in their groups)
- upload-url: mock SAS returned in dev (no Azure vars)
- upload-url: file validation errors (too large, bad type)
- Submit: happy path → SUBMITTED
- Submit: BR-13 — zero AttendanceRecord rows → 201 (no attendance check)
- Submit: re-upload → version 2, original preserved
- Submit: STRICT past deadline → 422
- Submit: LATE_ALLOWED past deadline → 201 LATE_SUBMITTED
- Submit: ADMIN_ONLY past deadline, participant → 403
- Submit: Admin on-behalf for ADMIN_ONLY past deadline → 201 OVERRIDE_BY_ADMIN
- /me/tasks and /me/submissions
- /submissions/:id/download → mock URL returned
- File validation unit tests
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class

from apps.assignments.models import AssignmentTask, Submission
from apps.common.file_validation import FileValidationError, validate_file

User = get_user_model()

NOW = timezone.now()
FUTURE_1H = NOW + timedelta(hours=1)
FUTURE_2H = NOW + timedelta(hours=2)
PAST_1H = NOW - timedelta(hours=1)
PAST_2H = NOW - timedelta(hours=2)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@assign.test", password="pass", full_name="Admin Assign", role="ADMIN"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@assign.test", password="pass", full_name="Part Assign", role="PARTICIPANT"
    )


@pytest.fixture
def other_participant(db):
    return User.objects.create_user(
        email="other@assign.test", password="pass", full_name="Other Assign", role="PARTICIPANT"
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
def other_client(other_participant):
    c = APIClient()
    c.force_authenticate(user=other_participant)
    return c


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(name="Assign Batch", created_by=admin_user)


@pytest.fixture
def membership(db, participant_user, group):
    return GroupMembership.objects.create(user=participant_user, group=group)


@pytest.fixture
def class_obj(db, group, admin_user):
    return Class.objects.create(
        group=group,
        title="Test Class",
        description="",
        starts_at=NOW - timedelta(hours=1),
        ends_at=NOW + timedelta(hours=1),
        created_by=admin_user,
    )


@pytest.fixture
def open_task(db, group, admin_user):
    return AssignmentTask.objects.create(
        group=group,
        title="Open Task",
        question="What is 2+2?",
        description="",
        instructions="",
        upload_open_at=PAST_2H,
        deadline_at=FUTURE_2H,
        late_policy="STRICT",
        is_open=True,
        created_by=admin_user,
    )


@pytest.fixture
def closed_task(db, group, admin_user):
    return AssignmentTask.objects.create(
        group=group,
        title="Closed Task",
        question="Past deadline strict?",
        description="",
        instructions="",
        upload_open_at=PAST_2H,
        deadline_at=PAST_1H,
        late_policy="STRICT",
        is_open=False,
        is_closed=True,
        created_by=admin_user,
    )


@pytest.fixture
def late_allowed_task(db, group, admin_user):
    return AssignmentTask.objects.create(
        group=group,
        title="Late Allowed Task",
        question="Late?",
        description="",
        instructions="",
        upload_open_at=PAST_2H,
        deadline_at=PAST_1H,
        late_policy="LATE_ALLOWED",
        is_open=True,
        created_by=admin_user,
    )


@pytest.fixture
def admin_only_task(db, group, admin_user):
    return AssignmentTask.objects.create(
        group=group,
        title="Admin Only Past Deadline",
        question="Admin only?",
        description="",
        instructions="",
        upload_open_at=PAST_2H,
        deadline_at=PAST_1H,
        late_policy="ADMIN_ONLY",
        is_open=True,
        created_by=admin_user,
    )


# ---------------------------------------------------------------------------
# AssignmentTask CRUD
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_create_task(admin_client, group):
    resp = admin_client.post(
        "/api/v1/assignments",
        {
            "group_id": str(group.id),
            "title": "New Task",
            "question": "Q?",
            "upload_open_at": (NOW - timedelta(hours=1)).isoformat(),
            "deadline_at": (NOW + timedelta(hours=3)).isoformat(),
            "late_policy": "STRICT",
        },
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["title"] == "New Task"
    assert data["group_id"] == str(group.id)
    assert AuditLog.objects.filter(action="assignment.task_created").exists()


@pytest.mark.django_db
def test_participant_cannot_create_task(participant_client, group):
    resp = participant_client.post(
        "/api/v1/assignments",
        {
            "group_id": str(group.id),
            "title": "Sneaky Task",
            "question": "Q?",
            "upload_open_at": (NOW - timedelta(hours=1)).isoformat(),
            "deadline_at": FUTURE_2H.isoformat(),
            "late_policy": "STRICT",
        },
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_list_all_tasks(admin_client, open_task, closed_task):
    resp = admin_client.get("/api/v1/assignments")
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()["data"]]
    assert str(open_task.id) in ids
    assert str(closed_task.id) in ids


@pytest.mark.django_db
def test_participant_list_only_open_tasks(participant_client, open_task, closed_task, membership):
    resp = participant_client.get("/api/v1/assignments")
    assert resp.status_code == 200
    data = resp.json()["data"]
    ids = [d["id"] for d in data]
    assert str(open_task.id) in ids
    assert str(closed_task.id) not in ids


@pytest.mark.django_db
def test_participant_cannot_see_other_groups_tasks(participant_client, admin_user):
    other_group = ClassGroup.objects.create(name="Other Group", created_by=admin_user)
    other_task = AssignmentTask.objects.create(
        group=other_group,
        title="Other Task",
        question="Q?",
        description="",
        instructions="",
        upload_open_at=PAST_2H,
        deadline_at=FUTURE_2H,
        is_open=True,
        created_by=admin_user,
    )
    resp = participant_client.get("/api/v1/assignments")
    ids = [d["id"] for d in resp.json()["data"]]
    assert str(other_task.id) not in ids


@pytest.mark.django_db
def test_admin_patch_task(admin_client, open_task):
    resp = admin_client.patch(
        f"/api/v1/assignments/{open_task.id}",
        {"title": "Updated Title"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "Updated Title"
    assert AuditLog.objects.filter(action="assignment.task_updated").exists()


@pytest.mark.django_db
def test_admin_delete_task(admin_client, open_task):
    resp = admin_client.delete(f"/api/v1/assignments/{open_task.id}")
    assert resp.status_code == 204
    assert not AssignmentTask.objects.filter(pk=open_task.id).exists()


@pytest.mark.django_db
def test_admin_retrieve_task(admin_client, open_task):
    resp = admin_client.get(f"/api/v1/assignments/{open_task.id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(open_task.id)


# ---------------------------------------------------------------------------
# upload-url endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_upload_url_returns_mock_sas_in_dev(participant_client, open_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/upload-url",
        {
            "file_name": "report.pdf",
            "file_size": 1024,
            "content_type": "application/pdf",
        },
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["upload_url"].startswith("mock://upload/")
    assert "blob_name" in data


@pytest.mark.django_db
def test_upload_url_file_too_large(participant_client, open_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/upload-url",
        {
            "file_name": "huge.pdf",
            "file_size": 30 * 1024 * 1024,  # 30 MB > 25 MB doc limit
            "content_type": "application/pdf",
        },
        format="json",
    )
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["code"] == "file.too_large"


@pytest.mark.django_db
def test_upload_url_type_not_allowed(participant_client, open_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/upload-url",
        {
            "file_name": "script.sh",
            "file_size": 100,
            "content_type": "application/x-sh",
        },
        format="json",
    )
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["code"] == "file.type_not_allowed"


# ---------------------------------------------------------------------------
# Submission — happy path
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_success(participant_client, open_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {
            "file_url": f"submissions/{open_task.id}/abc/report.pdf",
            "file_name": "report.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
        },
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "SUBMITTED"
    assert data["version"] == 1
    assert AuditLog.objects.filter(action="assignment.submission_created").exists()


# ---------------------------------------------------------------------------
# BR-13: attendance is NOT a precondition for submission
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_no_attendance_records_succeeds(participant_client, open_task, membership):
    """A participant with zero AttendanceRecord rows can still submit. BR-13."""
    from apps.attendance.models import AttendanceRecord
    assert AttendanceRecord.objects.filter(user__email="part@assign.test").count() == 0

    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {
            "file_url": "submissions/test/blob.pdf",
            "file_name": "blob.pdf",
            "file_type": "application/pdf",
            "file_size": 512,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "SUBMITTED"


# ---------------------------------------------------------------------------
# Re-upload creates version 2
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_reupload_creates_version_2(participant_client, open_task, membership):
    payload = {
        "file_url": "submissions/test/v1.pdf",
        "file_name": "v1.pdf",
        "file_type": "application/pdf",
        "file_size": 1024,
    }
    participant_client.post(f"/api/v1/assignments/{open_task.id}/submissions", payload, format="json")

    payload["file_url"] = "submissions/test/v2.pdf"
    payload["file_name"] = "v2.pdf"
    resp = participant_client.post(f"/api/v1/assignments/{open_task.id}/submissions", payload, format="json")
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["version"] == 2

    # Original v1 preserved
    assert Submission.objects.filter(task=open_task).count() == 2


# ---------------------------------------------------------------------------
# Late policy enforcement
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_strict_past_deadline_422(participant_client, closed_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{closed_task.id}/submissions",
        {
            "file_url": "submissions/test/late.pdf",
            "file_name": "late.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
        },
        format="json",
    )
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["code"] == "assignment.deadline_passed_strict"


@pytest.mark.django_db
def test_late_allowed_past_deadline_201(participant_client, late_allowed_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{late_allowed_task.id}/submissions",
        {
            "file_url": "submissions/test/late.pdf",
            "file_name": "late.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "LATE_SUBMITTED"


@pytest.mark.django_db
def test_admin_only_past_deadline_participant_403(participant_client, admin_only_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{admin_only_task.id}/submissions",
        {
            "file_url": "submissions/test/late.pdf",
            "file_name": "late.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
        },
        format="json",
    )
    assert resp.status_code == 403
    assert resp.json()["errors"][0]["code"] == "assignment.deadline_admin_only"


@pytest.mark.django_db
def test_admin_only_past_deadline_admin_succeeds(
    admin_client, admin_only_task, membership, participant_user
):
    resp = admin_client.post(
        f"/api/v1/assignments/{admin_only_task.id}/submissions",
        {
            "file_url": "submissions/test/admin_override.pdf",
            "file_name": "admin_override.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
            "user_id": str(participant_user.id),
        },
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "OVERRIDE_BY_ADMIN"
    assert str(data["user_id"]) == str(participant_user.id)


# ---------------------------------------------------------------------------
# Admin list_submissions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_list_submissions(admin_client, open_task, participant_user, membership):
    Submission.objects.create(
        task=open_task,
        user=participant_user,
        version=1,
        file_url="blob1",
        file_name="f1.pdf",
        file_type="application/pdf",
        file_size=1024,
        submitted_at=NOW,
        submitted_by=participant_user,
        status="SUBMITTED",
    )
    resp = admin_client.get(f"/api/v1/assignments/{open_task.id}/submissions")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


@pytest.mark.django_db
def test_participant_cannot_list_submissions(participant_client, open_task, membership):
    resp = participant_client.get(f"/api/v1/assignments/{open_task.id}/submissions")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# /me/tasks and /me/submissions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_me_tasks_returns_open_tasks(participant_client, open_task, closed_task, membership):
    resp = participant_client.get("/api/v1/me/tasks")
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()["data"]]
    assert str(open_task.id) in ids
    assert str(closed_task.id) not in ids


@pytest.mark.django_db
def test_me_submissions(participant_client, open_task, participant_user, membership):
    Submission.objects.create(
        task=open_task,
        user=participant_user,
        version=1,
        file_url="blob1",
        file_name="f1.pdf",
        file_type="application/pdf",
        file_size=1024,
        submitted_at=NOW,
        submitted_by=participant_user,
        status="SUBMITTED",
    )
    resp = participant_client.get("/api/v1/me/submissions")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["status"] == "SUBMITTED"


# ---------------------------------------------------------------------------
# /submissions/:id/download
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_download_returns_mock_url(participant_client, open_task, participant_user, membership):
    sub = Submission.objects.create(
        task=open_task,
        user=participant_user,
        version=1,
        file_url="submissions/task/uuid/f1.pdf",
        file_name="f1.pdf",
        file_type="application/pdf",
        file_size=1024,
        submitted_at=NOW,
        submitted_by=participant_user,
        status="SUBMITTED",
    )
    resp = participant_client.get(f"/api/v1/submissions/{sub.id}/download")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "download_url" in data
    assert "mock://download/" in data["download_url"]


@pytest.mark.django_db
def test_download_other_users_submission_403(
    other_client, open_task, participant_user, other_participant, membership
):
    sub = Submission.objects.create(
        task=open_task,
        user=participant_user,
        version=1,
        file_url="blob",
        file_name="f.pdf",
        file_type="application/pdf",
        file_size=1024,
        submitted_at=NOW,
        submitted_by=participant_user,
        status="SUBMITTED",
    )
    resp = other_client.get(f"/api/v1/submissions/{sub.id}/download")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /assignments/:id/close (B-14)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_close_open_task(admin_client, open_task):
    resp = admin_client.post(f"/api/v1/assignments/{open_task.id}/close")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_closed"] is True
    assert data["is_open"] is False
    open_task.refresh_from_db()
    assert open_task.is_closed is True
    assert open_task.is_open is False
    assert AuditLog.objects.filter(action="assignment.task_closed").exists()


@pytest.mark.django_db
def test_close_already_closed_returns_400(admin_client, closed_task):
    resp = admin_client.post(f"/api/v1/assignments/{closed_task.id}/close")
    assert resp.status_code == 400
    assert resp.json()["errors"][0]["code"] == "assignment.already_closed"


@pytest.mark.django_db
def test_participant_cannot_close_task(participant_client, open_task, membership):
    resp = participant_client.post(f"/api/v1/assignments/{open_task.id}/close")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_cannot_close_task(open_task):
    c = APIClient()
    resp = c.post(f"/api/v1/assignments/{open_task.id}/close")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# File validation unit tests
# ---------------------------------------------------------------------------


def test_validate_doc_ok():
    validate_file("report.pdf", 1024, "application/pdf")  # no exception


def test_validate_doc_too_large():
    with pytest.raises(FileValidationError) as exc_info:
        validate_file("big.pdf", 30 * 1024 * 1024, "application/pdf")
    assert exc_info.value.code == "file.too_large"


def test_validate_image_ok():
    validate_file("photo.jpg", 5 * 1024 * 1024, "image/jpeg")


def test_validate_image_too_large():
    with pytest.raises(FileValidationError) as exc_info:
        validate_file("huge.png", 11 * 1024 * 1024, "image/png")
    assert exc_info.value.code == "file.too_large"


def test_validate_video_ok():
    validate_file("lecture.mp4", 100 * 1024 * 1024, "video/mp4")


def test_validate_video_too_large():
    with pytest.raises(FileValidationError) as exc_info:
        validate_file("movie.mp4", 600 * 1024 * 1024, "video/mp4")
    assert exc_info.value.code == "file.too_large"


def test_validate_type_not_allowed():
    with pytest.raises(FileValidationError) as exc_info:
        validate_file("script.exe", 100, "application/x-msdownload")
    assert exc_info.value.code == "file.type_not_allowed"
