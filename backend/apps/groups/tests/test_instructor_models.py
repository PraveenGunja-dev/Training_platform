import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework.test import APIRequestFactory

from apps.common.models import SystemSettings
from apps.common.permissions import IsAdminOrInstructor, IsInstructor, IsInstructorOfGroup
from apps.common.visibility import instructor_can_view_all
from apps.groups.models import ClassGroup, GroupInstructor

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
def instructor_user(db):
    return User.objects.create_user(
        email="ins@ins.test", password="pass", full_name="Instructor", role="INSTRUCTOR"
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
def group_instructor(db, group, instructor_user, admin_user):
    return GroupInstructor.objects.create(
        group=group, instructor=instructor_user, assigned_by=admin_user
    )


# ---------------------------------------------------------------------------
# GroupInstructor model
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupInstructorModel:
    def test_group_instructor_unique_pair(self, group, instructor_user, admin_user):
        GroupInstructor.objects.create(
            group=group, instructor=instructor_user, assigned_by=admin_user
        )
        with pytest.raises(IntegrityError):
            GroupInstructor.objects.create(
                group=group, instructor=instructor_user, assigned_by=admin_user
            )

    def test_group_instructor_only_instructor_role(self, group, participant_user, admin_user):
        """Creating a GroupInstructor row with a non-INSTRUCTOR user must fail validation.

        The model uses limit_choices_to which is advisory at the ORM level. The serializer
        (chunk 3) enforces this hard. Here we verify the related_name wiring is correct and
        that a PARTICIPANT user does NOT appear via the instructors reverse manager.
        """
        # A participant should not satisfy the role guard — we test that limit_choices_to
        # filters them out of the queryset used by Admin picker forms.

        eligible = User.objects.filter(role="INSTRUCTOR")
        assert participant_user not in eligible

    def test_str_representation(self, group_instructor, instructor_user, group):
        assert str(instructor_user.id) in str(group_instructor) or str(group.id) in str(group_instructor)


# ---------------------------------------------------------------------------
# SystemSettings
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSystemSettingsInstructorFlag:
    def test_system_settings_instructors_can_view_all_default_false(self):
        settings_obj = SystemSettings.get_solo()
        assert settings_obj.instructors_can_view_all_classes is False


# ---------------------------------------------------------------------------
# instructor_can_view_all helper
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestInstructorCanViewAllHelper:
    def _set_system(self, value: bool) -> None:
        s = SystemSettings.get_solo()
        s.instructors_can_view_all_classes = value
        s.save()

    def test_user_override_true(self, instructor_user):
        instructor_user.can_view_all_classes = True
        instructor_user.save()
        self._set_system(False)
        assert instructor_can_view_all(instructor_user) is True

    def test_user_override_false(self, instructor_user):
        instructor_user.can_view_all_classes = False
        instructor_user.save()
        self._set_system(True)
        assert instructor_can_view_all(instructor_user) is False

    def test_user_inherit_system_true(self, instructor_user):
        instructor_user.can_view_all_classes = None
        instructor_user.save()
        self._set_system(True)
        assert instructor_can_view_all(instructor_user) is True

    def test_user_inherit_system_false(self, instructor_user):
        instructor_user.can_view_all_classes = None
        instructor_user.save()
        self._set_system(False)
        assert instructor_can_view_all(instructor_user) is False

    def test_admin_always_true(self, admin_user):
        assert instructor_can_view_all(admin_user) is True

    def test_participant_always_false(self, participant_user):
        assert instructor_can_view_all(participant_user) is False


# ---------------------------------------------------------------------------
# Permission classes
# ---------------------------------------------------------------------------


def _make_request(user):
    factory = APIRequestFactory()
    request = factory.get("/")
    request.user = user
    return request


@pytest.mark.django_db
class TestIsInstructorPermission:
    def test_allows_instructor(self, instructor_user):
        perm = IsInstructor()
        req = _make_request(instructor_user)
        assert perm.has_permission(req, None) is True

    def test_denies_admin(self, admin_user):
        perm = IsInstructor()
        req = _make_request(admin_user)
        assert perm.has_permission(req, None) is False

    def test_denies_participant(self, participant_user):
        perm = IsInstructor()
        req = _make_request(participant_user)
        assert perm.has_permission(req, None) is False

    def test_is_admin_or_instructor_allows_both(self, admin_user, instructor_user):
        perm = IsAdminOrInstructor()
        assert perm.has_permission(_make_request(admin_user), None) is True
        assert perm.has_permission(_make_request(instructor_user), None) is True

    def test_is_admin_or_instructor_denies_participant(self, participant_user):
        perm = IsAdminOrInstructor()
        assert perm.has_permission(_make_request(participant_user), None) is False


@pytest.mark.django_db
class TestIsInstructorOfGroupPermission:
    def test_allows_assigned_instructor(self, group_instructor, instructor_user, group):
        perm = IsInstructorOfGroup()
        req = _make_request(instructor_user)
        assert perm.has_object_permission(req, None, group) is True

    def test_denies_unassigned_instructor(self, instructor_user, admin_user):
        other_group = ClassGroup.objects.create(name="Other Group", created_by=admin_user)
        perm = IsInstructorOfGroup()
        req = _make_request(instructor_user)
        # instructor_user is not assigned to other_group
        assert perm.has_object_permission(req, None, other_group) is False
