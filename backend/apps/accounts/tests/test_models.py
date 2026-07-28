import pytest

from apps.accounts.models import User


@pytest.mark.django_db
class TestUserModel:
    def test_create_participant(self):
        user = User.objects.create_user(
            email="p1@test.com", password="password123", full_name="Participant One"
        )
        assert user.role == "PARTICIPANT"
        assert user.is_active is True
        assert user.check_password("password123")

    def test_create_superuser_defaults_admin(self):
        user = User.objects.create_superuser(
            email="admin@test.com", password="adminpass", full_name="Admin User"
        )
        assert user.role == "ADMIN"
        assert user.is_staff is True
        assert user.is_superuser is True

    def test_role_choices_has_four_roles(self):
        choices = [c[0] for c in User.ROLE_CHOICES]
        assert "ADMIN" in choices
        assert "SUB_MENTOR" in choices
        assert "LEAD_MENTOR" in choices
        assert "PARTICIPANT" in choices
        assert "INSTRUCTOR" not in choices
        assert "GROUP_ADMIN" not in choices

    def test_role_choices_includes_sub_mentor(self):
        choices = [c[0] for c in User.ROLE_CHOICES]
        assert "SUB_MENTOR" in choices
        assert ("SUB_MENTOR", "Sub-Mentor") in User.ROLE_CHOICES

    def test_role_choices_includes_lead_mentor(self):
        choices = [c[0] for c in User.ROLE_CHOICES]
        assert "LEAD_MENTOR" in choices
        assert ("LEAD_MENTOR", "Lead Mentor") in User.ROLE_CHOICES

    def test_user_can_view_all_classes_tri_state_default_none(self):
        user = User.objects.create_user(
            email="inst@test.com", password="pass", full_name="Inst User"
        )
        assert user.can_view_all_classes is None

    def test_uuid_primary_key(self):
        user = User.objects.create_user(
            email="uuid@test.com", password="pass", full_name="UUID User"
        )
        import uuid
        assert isinstance(user.id, uuid.UUID)

    def test_str_representation(self):
        user = User.objects.create_user(
            email="str@test.com", password="pass", full_name="String User"
        )
        assert "String User" in str(user)
        assert "str@test.com" in str(user)
