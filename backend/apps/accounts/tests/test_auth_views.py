import pytest
from django.urls import reverse

from apps.accounts.models import User


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        email="admin@test.com", password="password123", full_name="Admin User"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@test.com", password="password123", full_name="Participant User"
    )


@pytest.mark.django_db
class TestLoginView:
    def test_login_success_returns_access_and_cookie(self, client, admin_user):
        resp = client.post(
            reverse("auth-login"),
            {"email": "admin@test.com", "password": "password123"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert "access" in resp.json()["data"]
        assert resp.json()["data"]["user"]["role"] == "ADMIN"
        assert "refresh_token" in resp.cookies

    def test_login_wrong_password_returns_401(self, client, admin_user):
        resp = client.post(
            reverse("auth-login"),
            {"email": "admin@test.com", "password": "wrongpass"},
            content_type="application/json",
        )
        assert resp.status_code == 401
        assert resp.json()["errors"][0]["code"] == "auth.invalid_credentials"

    def test_login_role_participant(self, client, participant_user):
        resp = client.post(
            reverse("auth-login"),
            {"email": "part@test.com", "password": "password123"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["user"]["role"] == "PARTICIPANT"

    def test_login_inactive_user_fails(self, client, db):
        User.objects.create_user(
            email="inactive@test.com", password="password123", full_name="Inactive", is_active=False
        )
        resp = client.post(
            reverse("auth-login"),
            {"email": "inactive@test.com", "password": "password123"},
            content_type="application/json",
        )
        # H-01 fix: inactive accounts now return 401 with the same generic message
        # as wrong-password to prevent user enumeration via status-code differences.
        assert resp.status_code == 401
        assert resp.json()["errors"][0]["code"] == "auth.invalid_credentials"


@pytest.mark.django_db
class TestMeView:
    def _auth_headers(self, client, email, password):
        resp = client.post(
            reverse("auth-login"),
            {"email": email, "password": password},
            content_type="application/json",
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {resp.json()['data']['access']}"}

    def test_me_returns_user(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.get(reverse("me"), **headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "admin@test.com"
        assert data["role"] in ("ADMIN", "PARTICIPANT")

    def test_me_unauthenticated_returns_401(self, client):
        resp = client.get(reverse("me"))
        assert resp.status_code == 401

    def test_me_patch_updates_full_name(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.patch(
            reverse("me"),
            {"full_name": "Updated Name"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["full_name"] == "Updated Name"


@pytest.mark.django_db
class TestLogoutView:
    def test_logout_clears_cookie(self, client, admin_user):
        login_resp = client.post(
            reverse("auth-login"),
            {"email": "admin@test.com", "password": "password123"},
            content_type="application/json",
        )
        assert "refresh_token" in login_resp.cookies

        logout_resp = client.post(reverse("auth-logout"))
        assert logout_resp.status_code == 204


@pytest.mark.django_db
class TestSetPasswordView:
    def test_set_password_with_valid_token(self, client, db):
        import hashlib

        from django.core.signing import TimestampSigner

        from apps.accounts.models import PasswordSetupToken

        new_user = User.objects.create_user(
            email="newbie@test.com", password=None, full_name="New User", is_active=False
        )
        signer = TimestampSigner()
        raw_token = signer.sign(str(new_user.id))
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        PasswordSetupToken.objects.create(user=new_user, token_hash=token_hash)

        resp = client.post(
            reverse("auth-set-password"),
            {"token": raw_token, "password": "newpassword123"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert "access" in resp.json()["data"]

        new_user.refresh_from_db()
        assert new_user.is_active is True

    def test_set_password_invalid_token_returns_400(self, client, db):
        resp = client.post(
            reverse("auth-set-password"),
            {"token": "invalid.token.value", "password": "newpassword123"},
            content_type="application/json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestChangePasswordView:
    def _auth_headers(self, client, email, password):
        resp = client.post(
            reverse("auth-login"),
            {"email": email, "password": password},
            content_type="application/json",
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {resp.json()['data']['access']}"}

    def test_change_password_success(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-password"),
            {"current_password": "password123", "new_password": "newpassword456"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["detail"] == "Password changed successfully."

    def test_change_password_wrong_current(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-password"),
            {"current_password": "wrongpass", "new_password": "newpassword456"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "auth.wrong_password"

    def test_change_password_too_short(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-password"),
            {"current_password": "password123", "new_password": "short"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400

    def test_change_password_unauthenticated(self, client):
        resp = client.post(
            reverse("me-password"),
            {"current_password": "password123", "new_password": "newpassword456"},
            content_type="application/json",
        )
        assert resp.status_code == 401


@pytest.mark.django_db
class TestChangeEmailView:
    def _auth_headers(self, client, email, password):
        resp = client.post(
            reverse("auth-login"),
            {"email": email, "password": password},
            content_type="application/json",
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {resp.json()['data']['access']}"}

    def test_change_email_success(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "new.admin@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == "new.admin@test.com"
        admin_user.refresh_from_db()
        assert admin_user.email == "new.admin@test.com"

    def test_change_email_new_email_case_normalised(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "ADMIN@TEST.COM", "new_email": "New.Admin@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["email"] == "new.admin@test.com"

    def test_change_email_wrong_current_email(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "wrong@test.com", "new_email": "new.admin@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "email.wrong_current"

    def test_change_email_wrong_password(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "new.admin@test.com", "current_password": "wrongpass"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "auth.wrong_password"

    def test_change_email_same_as_current(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "admin@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "email.same_as_current"

    def test_change_email_duplicate(self, client, admin_user, participant_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "part@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "email.already_exists"

    def test_change_email_invalid_format(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        resp = client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "not-an-email", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        assert resp.status_code == 400

    def test_change_email_unauthenticated(self, client):
        resp = client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "new@test.com", "current_password": "password123"},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_login_with_new_email_after_change(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "changed@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        # Login with new email should succeed
        resp = client.post(
            reverse("auth-login"),
            {"email": "changed@test.com", "password": "password123"},
            content_type="application/json",
        )
        assert resp.status_code == 200

    def test_login_with_old_email_after_change_fails(self, client, admin_user):
        headers = self._auth_headers(client, "admin@test.com", "password123")
        client.post(
            reverse("me-email"),
            {"current_email": "admin@test.com", "new_email": "changed@test.com", "current_password": "password123"},
            content_type="application/json",
            **headers,
        )
        # Login with old email should fail
        resp = client.post(
            reverse("auth-login"),
            {"email": "admin@test.com", "password": "password123"},
            content_type="application/json",
        )
        assert resp.status_code == 401


@pytest.mark.django_db
class TestRefreshView:
    def test_refresh_returns_new_access(self, client, admin_user):
        login_resp = client.post(
            reverse("auth-login"),
            {"email": "admin@test.com", "password": "password123"},
            content_type="application/json",
        )
        assert "refresh_token" in login_resp.cookies

        refresh_resp = client.post(reverse("auth-refresh"))
        assert refresh_resp.status_code == 200
        assert "access" in refresh_resp.json()["data"]

    def test_refresh_without_cookie_returns_401(self, client):
        resp = client.post(reverse("auth-refresh"))
        assert resp.status_code == 401
