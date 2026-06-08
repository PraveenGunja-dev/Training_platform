import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.assignments.models import AssignmentTask, Submission
from apps.groups.models import ClassGroup, GroupMembership

User = get_user_model()

_counter = 0


def _uid():
    global _counter
    _counter += 1
    return _counter


@pytest.fixture
def test_group(db):
    return ClassGroup.objects.create(name=f"Test Group {_uid()}")


@pytest.fixture
def test_user(db):
    u = User.objects.create_user(
        email=f"user{_uid()}@test.com",
        password="pass",
        role="PARTICIPANT",
    )
    return u


@pytest.fixture
def test_task(db, test_group):
    now = timezone.now()
    return AssignmentTask.objects.create(
        group=test_group,
        title=f"Task {_uid()}",
        question="What is the answer?",
        upload_open_at=now,
        deadline_at=now + timezone.timedelta(days=7),
        late_policy="STRICT",
        is_open=True,
    )


@pytest.fixture
def submission_factory(db, test_task, test_user):
    def _make(task=None, user=None, **kwargs):
        t = task or test_task
        u = user or test_user
        GroupMembership.objects.get_or_create(group=t.group, user=u)
        return Submission.objects.create(
            task=t,
            user=u,
            version=1,
            file_url=f"submissions/{t.id}/test.pdf",
            file_name="test.pdf",
            file_type="application/pdf",
            file_size=1024,
            status="SUBMITTED",
            submitted_at=timezone.now(),
            **kwargs,
        )
    return _make
