"""Tests for the seed_demo management command."""
import pytest
from django.core.management import call_command

from apps.accounts.models import User
from apps.assignments.models import AssignmentTask
from apps.documents.models import Document, ParticipantSharedDoc
from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class


@pytest.mark.django_db
def test_seed_demo_creates_expected_data():
    call_command("seed_demo", verbosity=0)

    assert User.objects.filter(role="ADMIN").count() == 3
    assert User.objects.filter(role="PARTICIPANT").count() == 25
    assert ClassGroup.objects.count() == 4
    # 3 classes per group
    assert Class.objects.count() == 12
    # At least 8 tasks created
    assert AssignmentTask.objects.count() >= 8
    # At least 5 documents
    assert Document.objects.count() >= 5
    # Exactly 5 pending shared docs
    assert ParticipantSharedDoc.objects.filter(status="PENDING").count() == 5


@pytest.mark.django_db
def test_seed_demo_is_idempotent():
    call_command("seed_demo", verbosity=0)
    user_count = User.objects.count()
    group_count = ClassGroup.objects.count()
    class_count = Class.objects.count()

    # Run again — should not raise or create duplicates
    call_command("seed_demo", verbosity=0)

    assert User.objects.count() == user_count
    assert ClassGroup.objects.count() == group_count
    assert Class.objects.count() == class_count


@pytest.mark.django_db
def test_seed_demo_participant_emails():
    call_command("seed_demo", verbosity=0)
    expected_emails = [
        "rutvik.prajapati@adani.com",
        "priya.sharma@adani.com",
        "arjun.mehta@adani.com",
        "divya.nair@adani.com",
        "rohan.verma@adani.com",
        "sneha.patel@adani.com",
        "vikram.singh@adani.com",
        "anita.desai@adani.com",
        "rahul.gupta@adani.com",
        "kavya.reddy@adani.com",
        "amit.kumar@adani.com",
        "pooja.iyer@adani.com",
        "suresh.joshi@adani.com",
        "meera.pillai@adani.com",
        "nikhil.shah@adani.com",
        "tanvi.saxena@adani.com",
        "deepak.rao@adani.com",
        "shreya.banerjee@adani.com",
        "karan.malhotra@adani.com",
        "nisha.agarwal@adani.com",
        "sanjay.mishra@adani.com",
        "aisha.qureshi@adani.com",
        "ravi.krishnan@adani.com",
        "sonal.kapoor@adani.com",
        "gaurav.pandey@adani.com",
    ]
    for email in expected_emails:
        assert User.objects.filter(email=email, role="PARTICIPANT").exists()


@pytest.mark.django_db
def test_seed_demo_admin_emails():
    call_command("seed_demo", verbosity=0)
    for email in ["kiran.kr@adani.com", "manish.kumar@adani.com", "mira.sharma@adani.com"]:
        assert User.objects.filter(email=email, role="ADMIN").exists()


@pytest.mark.django_db
def test_seed_demo_group_memberships():
    call_command("seed_demo", verbosity=0)
    # Total: 6 + 6 + 6 + 7 = 25 memberships
    assert GroupMembership.objects.count() == 25


@pytest.mark.django_db
def test_seed_demo_document_visibility_mix():
    call_command("seed_demo", verbosity=0)
    assert Document.objects.filter(visibility="GROUP").exists()
    assert Document.objects.filter(visibility="STAFF_ONLY").exists()


@pytest.mark.django_db
def test_seed_demo_task_policy_mix():
    call_command("seed_demo", verbosity=0)
    assert AssignmentTask.objects.filter(late_policy="STRICT").exists()
    assert AssignmentTask.objects.filter(late_policy="LATE_ALLOWED").exists()
    assert AssignmentTask.objects.filter(late_policy="ADMIN_ONLY").exists()
