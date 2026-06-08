import uuid

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.assignments.models import AssignmentTask, Submission, SubmissionReview
from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _url(submission_id):
    return f"/api/v1/assignments/submissions/{submission_id}/review"


def _auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin_rev@test.com", password="pass", role="ADMIN")


@pytest.fixture
def instructor(db):
    return User.objects.create_user(email="inst_rev@test.com", password="pass", role="INSTRUCTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part_rev@test.com", password="pass", role="PARTICIPANT")


@pytest.fixture
def other_participant(db):
    return User.objects.create_user(email="part2_rev@test.com", password="pass", role="PARTICIPANT")


@pytest.fixture
def group(db):
    return ClassGroup.objects.create(name="Review API Group")


@pytest.fixture
def task(db, group):
    now = timezone.now()
    return AssignmentTask.objects.create(
        group=group,
        title="Review API Task",
        question="Describe it.",
        upload_open_at=now,
        deadline_at=now + timezone.timedelta(days=7),
        late_policy="STRICT",
        is_open=True,
    )


@pytest.fixture
def submission(db, task, participant):
    GroupMembership.objects.get_or_create(group=task.group, user=participant)
    return Submission.objects.create(
        task=task,
        user=participant,
        version=1,
        file_url="submissions/test/file.pdf",
        file_name="file.pdf",
        file_type="application/pdf",
        file_size=1024,
        status="SUBMITTED",
        submitted_at=timezone.now(),
    )


@pytest.fixture
def other_submission(db, task, other_participant):
    GroupMembership.objects.get_or_create(group=task.group, user=other_participant)
    return Submission.objects.create(
        task=task,
        user=other_participant,
        version=1,
        file_url="submissions/test/file2.pdf",
        file_name="file2.pdf",
        file_type="application/pdf",
        file_size=1024,
        status="SUBMITTED",
        submitted_at=timezone.now(),
    )


@pytest.fixture
def existing_review(db, submission, admin):
    return SubmissionReview.objects.create(
        submission=submission,
        reviewer=admin,
        comment="Initial comment",
    )


# ---------------------------------------------------------------------------
# GET /assignments/submissions/{id}/review
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGetReview:

    def test_admin_can_read_review(self, submission, existing_review, admin):
        r = _auth(admin).get(_url(submission.id))
        assert r.status_code == 200
        assert r.data["data"]["comment"] == "Initial comment"

    def test_instructor_in_group_can_read_review(self, submission, existing_review, instructor, group):
        GroupInstructor.objects.create(group=group, instructor=instructor)
        r = _auth(instructor).get(_url(submission.id))
        assert r.status_code == 200

    def test_instructor_outside_group_cannot_read_review(self, submission, existing_review, instructor):
        r = _auth(instructor).get(_url(submission.id))
        assert r.status_code == 403

    def test_participant_can_read_own_review(self, submission, existing_review, participant):
        r = _auth(participant).get(_url(submission.id))
        assert r.status_code == 200
        assert r.data["data"]["comment"] == "Initial comment"

    def test_participant_cannot_read_others_review(self, other_submission, participant):
        r = _auth(participant).get(_url(other_submission.id))
        assert r.status_code == 403

    def test_returns_null_when_no_review_exists(self, submission, admin):
        r = _auth(admin).get(_url(submission.id))
        assert r.status_code == 200
        assert r.data["data"] is None

    def test_returns_review_data_when_review_exists(self, submission, existing_review, admin):
        r = _auth(admin).get(_url(submission.id))
        assert r.status_code == 200
        data = r.data["data"]
        assert str(data["id"]) == str(existing_review.id)
        assert data["comment"] == "Initial comment"

    def test_missing_submission_returns_404(self, admin):
        r = _auth(admin).get(_url(uuid.uuid4()))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /assignments/submissions/{id}/review
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestPostReview:

    def test_admin_create_comment_only(self, submission, admin):
        r = _auth(admin).post(_url(submission.id), {"comment": "Looks good"}, format="json")
        assert r.status_code == 201
        assert r.data["data"]["comment"] == "Looks good"

    def test_admin_create_numeric_grade_only(self, submission, admin):
        r = _auth(admin).post(_url(submission.id), {"grade_numeric": "8.50"}, format="json")
        assert r.status_code == 201
        assert float(r.data["data"]["grade_numeric"]) == pytest.approx(8.5)

    def test_admin_create_letter_grade_only(self, submission, admin):
        r = _auth(admin).post(_url(submission.id), {"grade_letter": "A"}, format="json")
        assert r.status_code == 201
        assert r.data["data"]["grade_letter"] == "A"

    def test_admin_cannot_set_both_grades(self, submission, admin):
        r = _auth(admin).post(
            _url(submission.id),
            {"grade_numeric": "8.0", "grade_letter": "A"},
            format="json",
        )
        assert r.status_code == 400

    def test_admin_update_existing_review(self, submission, existing_review, admin):
        r = _auth(admin).post(
            _url(submission.id),
            {"comment": "Updated comment"},
            format="json",
        )
        assert r.status_code == 200
        assert r.data["data"]["comment"] == "Updated comment"

    def test_instructor_in_group_can_create_review(self, submission, instructor, group):
        GroupInstructor.objects.create(group=group, instructor=instructor)
        r = _auth(instructor).post(_url(submission.id), {"comment": "Nice work"}, format="json")
        assert r.status_code == 201

    def test_instructor_outside_group_cannot_review(self, submission, instructor):
        r = _auth(instructor).post(_url(submission.id), {"comment": "Nice"}, format="json")
        assert r.status_code == 403

    def test_participant_cannot_post_review(self, submission, participant):
        r = _auth(participant).post(_url(submission.id), {"comment": "X"}, format="json")
        assert r.status_code == 403

    def test_unauthenticated_returns_401(self, submission):
        r = APIClient().post(_url(submission.id), {"comment": "X"}, format="json")
        assert r.status_code == 401

    def test_missing_submission_returns_404(self, admin):
        r = _auth(admin).post(_url(uuid.uuid4()), {"comment": "X"}, format="json")
        assert r.status_code == 404

    def test_empty_body_creates_empty_review(self, submission, admin):
        r = _auth(admin).post(_url(submission.id), {}, format="json")
        assert r.status_code == 201
        assert r.data["data"]["comment"] == ""
        assert r.data["data"]["grade_numeric"] is None
        assert r.data["data"]["grade_letter"] == ""
