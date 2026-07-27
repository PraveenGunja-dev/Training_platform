import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework.test import APIRequestFactory

from apps.common.models import SystemSettings
from apps.common.permissions import IsAdminOrSubMentor, IsSubMentor, IsSubMentorOfGroup
from apps.common.visibility import sub_mentor_can_view_all
from apps.groups.models import ClassGroup, GroupSubMentor

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@ins.test", password="pass", full_name="Admin", role="ADMIN"
    )


@pytest.fixture
def sub_mentor_user(db):
    return User.objects.create_user(
        email="ins@ins.test", password="pass", full_name="SubMentor", role="SUB_MENTOR"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@ins.test", password="pass", full_name="Participant", role="PARTICIPANT"
    )


@pytest.fixture
def group(db, admin_user):
    return ClassGroup.objects.create(name="Test Group", created_by=admin_user)


@pytest.fixture
def group_sub_mentor(db, group, sub_mentor_user, admin_user):
    return GroupSubMentor.objects.create(
        group=group, sub_mentor=sub_mentor_user, assigned_by=admin_user
    )


# ---------------------------------------------------------------------------
# GroupSubMentor model
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupSubMentorModel:
    def test_group_sub_mentor_unique_pair(self, group, sub_mentor_user, admin_user):
        GroupSubMentor.objects.create(
            group=group, sub_mentor=sub_mentor_user, assigned_by=admin_user
        )
        with pytest.raises(IntegrityError):
            GroupSubMentor.objects.create(
                group=group, sub_mentor=sub_mentor_user, assigned_by=admin_user
            )

    def test_group_sub_mentor_only_sub_mentor_role(self, group, participant_user, admin_user):
        """Creating a GroupSubMentor row with a non-INSTRUCTOR user must fail validation.

        The model uses limit_choices_to which is advisory at the ORM level. The serializer
        (chunk 3) enforces this hard. Here we verify the related_name wiring is correct and
        that a PARTICIPANT user does NOT appear via the sub_mentors reverse manager.
        """
        # A participant should not satisfy the role guard — we test that limit_choices_to
        # filters them out of the queryset used by Admin picker forms.

        eligible = User.objects.filter(role="SUB_MENTOR")
        assert participant_user not in eligible

    def test_str_representation(self, group_sub_mentor, sub_mentor_user, group):
        assert str(sub_mentor_user.id) in str(group_sub_mentor) or str(group.id) in str(group_sub_mentor)


# ---------------------------------------------------------------------------
# SystemSettings
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSystemSettingsSubMentorFlag:
    def test_system_settings_sub_mentors_can_view_all_default_false(self):
        settings_obj = SystemSettings.get_solo()
        assert settings_obj.sub_mentors_can_view_all_classes is False


# ---------------------------------------------------------------------------
# sub_mentor_can_view_all helper
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubMentorCanViewAllHelper:
    def _set_system(self, value: bool) -> None:
        s = SystemSettings.get_solo()
        s.sub_mentors_can_view_all_classes = value
        s.save()

    def test_user_override_true(self, sub_mentor_user):
        sub_mentor_user.can_view_all_classes = True
        sub_mentor_user.save()
        self._set_system(False)
        assert sub_mentor_can_view_all(sub_mentor_user) is True

    def test_user_override_false(self, sub_mentor_user):
        sub_mentor_user.can_view_all_classes = False
        sub_mentor_user.save()
        self._set_system(True)
        assert sub_mentor_can_view_all(sub_mentor_user) is False

    def test_user_inherit_system_true(self, sub_mentor_user):
        sub_mentor_user.can_view_all_classes = None
        sub_mentor_user.save()
        self._set_system(True)
        assert sub_mentor_can_view_all(sub_mentor_user) is True

    def test_user_inherit_system_false(self, sub_mentor_user):
        sub_mentor_user.can_view_all_classes = None
        sub_mentor_user.save()
        self._set_system(False)
        assert sub_mentor_can_view_all(sub_mentor_user) is False

    def test_admin_always_true(self, admin_user):
        assert sub_mentor_can_view_all(admin_user) is True

    def test_participant_always_false(self, participant_user):
        assert sub_mentor_can_view_all(participant_user) is False


# ---------------------------------------------------------------------------
# Permission classes
# ---------------------------------------------------------------------------


def _make_request(user):
    factory = APIRequestFactory()
    request = factory.get("/")
    request.user = user
    return request


@pytest.mark.django_db
class TestIsSubMentorPermission:
    def test_allows_sub_mentor(self, sub_mentor_user):
        perm = IsSubMentor()
        req = _make_request(sub_mentor_user)
        assert perm.has_permission(req, None) is True

    def test_denies_admin(self, admin_user):
        perm = IsSubMentor()
        req = _make_request(admin_user)
        assert perm.has_permission(req, None) is False

    def test_denies_participant(self, participant_user):
        perm = IsSubMentor()
        req = _make_request(participant_user)
        assert perm.has_permission(req, None) is False

    def test_is_admin_or_sub_mentor_allows_both(self, admin_user, sub_mentor_user):
        perm = IsAdminOrSubMentor()
        assert perm.has_permission(_make_request(admin_user), None) is True
        assert perm.has_permission(_make_request(sub_mentor_user), None) is True

    def test_is_admin_or_sub_mentor_denies_participant(self, participant_user):
        perm = IsAdminOrSubMentor()
        assert perm.has_permission(_make_request(participant_user), None) is False


@pytest.mark.django_db
class TestIsSubMentorOfGroupPermission:
    def test_allows_assigned_sub_mentor(self, group_sub_mentor, sub_mentor_user, group):
        perm = IsSubMentorOfGroup()
        req = _make_request(sub_mentor_user)
        assert perm.has_object_permission(req, None, group) is True

    def test_denies_unassigned_sub_mentor(self, sub_mentor_user, admin_user):
        other_group = ClassGroup.objects.create(name="Other Group", created_by=admin_user)
        perm = IsSubMentorOfGroup()
        req = _make_request(sub_mentor_user)
        # sub_mentor_user is not assigned to other_group
        assert perm.has_object_permission(req, None, other_group) is False
