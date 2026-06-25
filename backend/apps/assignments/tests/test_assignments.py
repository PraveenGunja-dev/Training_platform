"""Tests for the assignments app (B-06, Option A binary storage).

Covers:
- AssignmentTask CRUD (Admin only create/update/delete)
- Participant list scoping (only open tasks in their groups)
- Submit: happy path → SUBMITTED (multipart file upload)
- Submit: BR-13 — zero AttendanceRecord rows → 201 (no attendance check)
- Submit: re-upload → version 2, original preserved
- Submit: STRICT past deadline → 422
- Submit: LATE_ALLOWED past deadline → 201 LATE_SUBMITTED
- Submit: ADMIN_ONLY past deadline, participant → 403
- Submit: Admin on-behalf for ADMIN_ONLY past deadline → 201 OVERRIDE_BY_ADMIN
- /me/tasks and /me/submissions
- /submissions/:id/file → streams binary content
- /assignments/:id/question-file → upload + download
- File validation unit tests
"""

from __future__ import annotations

from datetime import timedelta
from io import BytesIO

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


def _pdf_file(name: str = "report.pdf", size: int = 1024) -> BytesIO:
    """Return a BytesIO that looks like a small PDF file."""
    buf = BytesIO(b"%PDF-1.4 " + b"x" * max(0, size - 9))
    buf.name = name
    buf.seek(0)
    return buf


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
# Question file upload/download endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_upload_question_file(admin_client, open_task):
    buf = _pdf_file("question.pdf", 512)
    resp = admin_client.post(
        f"/api/v1/assignments/{open_task.id}/question-file",
        {"file": buf},
        format="multipart",
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["question_file_name"] == "question.pdf"
    assert data["question_file_url"] == f"/api/v1/assignments/{open_task.id}/question-file"


@pytest.mark.django_db
def test_question_file_download(admin_client, open_task):
    # Upload first
    buf = _pdf_file("question.pdf", 512)
    admin_client.post(
        f"/api/v1/assignments/{open_task.id}/question-file",
        {"file": buf},
        format="multipart",
    )
    # Now download
    resp = admin_client.get(f"/api/v1/assignments/{open_task.id}/question-file")
    assert resp.status_code == 200
    assert resp["Content-Disposition"].startswith('attachment;')


@pytest.mark.django_db
def test_question_file_download_404_when_no_file(admin_client, open_task):
    resp = admin_client.get(f"/api/v1/assignments/{open_task.id}/question-file")
    assert resp.status_code == 404
    assert resp.json()["errors"][0]["code"] == "not_found"


@pytest.mark.django_db
def test_participant_cannot_upload_question_file(participant_client, open_task, membership):
    buf = _pdf_file()
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/question-file",
        {"file": buf},
        format="multipart",
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Submission — happy path (multipart)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_success(participant_client, open_task, membership):
    buf = _pdf_file("report.pdf", 1024)
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {"file": buf, "note": ""},
        format="multipart",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "SUBMITTED"
    assert data["version"] == 1
    assert data["file_url"] == f"/api/v1/submissions/{data['id']}/file"
    assert AuditLog.objects.filter(action="assignment.submission_created").exists()


# ---------------------------------------------------------------------------
# BR-13: attendance is NOT a precondition for submission
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_no_attendance_records_succeeds(participant_client, open_task, membership):
    """A participant with zero AttendanceRecord rows can still submit. BR-13."""
    from apps.attendance.models import AttendanceRecord
    assert AttendanceRecord.objects.filter(user__email="part@assign.test").count() == 0

    buf = _pdf_file("blob.pdf", 512)
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {"file": buf},
        format="multipart",
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "SUBMITTED"


# ---------------------------------------------------------------------------
# Re-upload creates version 2
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_reupload_creates_version_2(participant_client, open_task, membership):
    buf1 = _pdf_file("v1.pdf", 1024)
    participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {"file": buf1},
        format="multipart",
    )

    buf2 = _pdf_file("v2.pdf", 1024)
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {"file": buf2},
        format="multipart",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["version"] == 2

    # Original v1 preserved
    assert Submission.objects.filter(task=open_task).count() == 2


# ---------------------------------------------------------------------------
# Submit: missing file → 400
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submit_no_file_returns_400(participant_client, open_task, membership):
    resp = participant_client.post(
        f"/api/v1/assignments/{open_task.id}/submissions",
        {},
        format="multipart",
    )
    assert resp.status_code == 400
    assert resp.json()["errors"][0]["field"] == "file"


# ---------------------------------------------------------------------------
# Late policy enforcement
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_strict_past_deadline_422(participant_client, closed_task, membership):
    buf = _pdf_file("late.pdf", 1024)
    resp = participant_client.post(
        f"/api/v1/assignments/{closed_task.id}/submissions",
        {"file": buf},
        format="multipart",
    )
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["code"] == "assignment.deadline_passed_strict"


@pytest.mark.django_db
def test_late_allowed_past_deadline_201(participant_client, late_allowed_task, membership):
    buf = _pdf_file("late.pdf", 1024)
    resp = participant_client.post(
        f"/api/v1/assignments/{late_allowed_task.id}/submissions",
        {"file": buf},
        format="multipart",
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "LATE_SUBMITTED"


@pytest.mark.django_db
def test_admin_only_past_deadline_participant_403(participant_client, admin_only_task, membership):
    buf = _pdf_file("late.pdf", 1024)
    resp = participant_client.post(
        f"/api/v1/assignments/{admin_only_task.id}/submissions",
        {"file": buf},
        format="multipart",
    )
    assert resp.status_code == 403
    assert resp.json()["errors"][0]["code"] == "assignment.deadline_admin_only"


@pytest.mark.django_db
def test_admin_only_past_deadline_admin_succeeds(
    admin_client, admin_only_task, membership, participant_user
):
    buf = _pdf_file("admin_override.pdf", 1024)
    resp = admin_client.post(
        f"/api/v1/assignments/{admin_only_task.id}/submissions",
        {"file": buf, "user_id": str(participant_user.id)},
        format="multipart",
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
        file_data=b"binary content",
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
        file_data=b"binary content",
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
# /submissions/:id/file — binary download
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_file_download_streams_binary(participant_client, open_task, participant_user, membership):
    file_content = b"PDF binary content here"
    sub = Submission.objects.create(
        task=open_task,
        user=participant_user,
        version=1,
        file_data=file_content,
        file_name="f1.pdf",
        file_type="application/pdf",
        file_size=len(file_content),
        submitted_at=NOW,
        submitted_by=participant_user,
        status="SUBMITTED",
    )
    resp = participant_client.get(f"/api/v1/submissions/{sub.id}/file")
    assert resp.status_code == 200
    assert resp["Content-Disposition"].startswith("attachment;")
    assert resp.content == file_content


@pytest.mark.django_db
def test_file_download_other_users_submission_403(
    other_client, open_task, participant_user, other_participant, membership
):
    sub = Submission.objects.create(
        task=open_task,
        user=participant_user,
        version=1,
        file_data=b"data",
        file_name="f.pdf",
        file_type="application/pdf",
        file_size=4,
        submitted_at=NOW,
        submitted_by=participant_user,
        status="SUBMITTED",
    )
    resp = other_client.get(f"/api/v1/submissions/{sub.id}/file")
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
