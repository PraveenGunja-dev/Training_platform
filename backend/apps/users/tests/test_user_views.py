import pytest

from apps.accounts.models import User


# ------------------------------------------------------------------ #
# Fixtures                                                             #
# ------------------------------------------------------------------ #


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        email="admin@test.com", password="pass123", full_name="Admin User"
    )


@pytest.fixture
def participant_user(db):
    return User.objects.create_user(
        email="part@test.com",
        password="pass123",
        full_name="Part User",
        role="PARTICIPANT",
    )


@pytest.fixture
def pending_user(db):
    # Invited but hasn't set a password yet (is_active=False, unusable password)
    return User.objects.create_user(
        email="pending@test.com",
        password=None,
        full_name="Pending User",
        role="PARTICIPANT",
        is_active=False,
    )


def _get_token(client, email: str, password: str) -> str:
    resp = client.post(
        "/api/v1/auth/login",
        {"email": email, "password": password},
        content_type="application/json",
    )
    return resp.json()["data"]["access"]


def _auth(client, email: str, password: str) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_get_token(client, email, password)}"}


# ------------------------------------------------------------------ #
# GET /api/v1/users                                                    #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestUserList:
    def test_list_returns_200_for_admin(self, client, admin_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.get("/api/v1/users", **h)
        assert resp.status_code == 200
        assert "data" in resp.json()
        emails = [u["email"] for u in resp.json()["data"]]
        assert "admin@test.com" in emails

    def test_list_filter_by_role(self, client, admin_user, participant_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.get("/api/v1/users?role=PARTICIPANT", **h)
        assert resp.status_code == 200
        for u in resp.json()["data"]:
            assert u["role"] == "PARTICIPANT"

    def test_list_filter_by_status_active(self, client, admin_user, pending_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.get("/api/v1/users?status=active", **h)
        assert resp.status_code == 200
        assert all(u["is_active"] for u in resp.json()["data"])

    def test_list_filter_by_status_inactive(self, client, admin_user, pending_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.get("/api/v1/users?status=inactive", **h)
        assert resp.status_code == 200
        assert all(not u["is_active"] for u in resp.json()["data"])

    def test_list_participant_returns_403(self, client, admin_user, participant_user):
        h = _auth(client, "part@test.com", "pass123")
        resp = client.get("/api/v1/users", **h)
        assert resp.status_code == 403

    def test_list_unauthenticated_returns_401(self, client, admin_user):
        resp = client.get("/api/v1/users")
        assert resp.status_code == 401


# ------------------------------------------------------------------ #
# POST /api/v1/users  (invite single)                                  #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestInviteUser:
    def test_invite_creates_user_and_sends_email(self, client, admin_user, mailoutbox):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            "/api/v1/users",
            {"email": "new@test.com", "full_name": "New User", "role": "PARTICIPANT"},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["email"] == "new@test.com"
        assert data["role"] == "PARTICIPANT"
        assert User.objects.filter(email="new@test.com").exists()
        assert len(mailoutbox) == 1
        assert "new@test.com" in mailoutbox[0].recipients()

    def test_invite_existing_email_returns_400(self, client, admin_user, participant_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            "/api/v1/users",
            {"email": "part@test.com", "full_name": "Dup", "role": "PARTICIPANT"},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "user.already_exists"

    def test_invite_missing_fields_returns_400(self, client, admin_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            "/api/v1/users",
            {"email": "x@test.com"},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 400

    def test_invite_participant_returns_403(self, client, admin_user, participant_user):
        h = _auth(client, "part@test.com", "pass123")
        resp = client.post(
            "/api/v1/users",
            {"email": "x@test.com", "full_name": "X", "role": "PARTICIPANT"},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 403


# ------------------------------------------------------------------ #
# POST /api/v1/users/bulk-invite                                       #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestBulkInvite:
    def test_bulk_invite_mixed_rows(self, client, admin_user, participant_user, mailoutbox):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            "/api/v1/users/bulk-invite",
            {
                "rows": [
                    {"email": "part@test.com", "full_name": "Dup", "role": "PARTICIPANT"},
                    {"email": "new1@test.com", "full_name": "New 1", "role": "PARTICIPANT"},
                    {"email": "new2@test.com", "full_name": "New 2", "role": "ADMIN"},
                ]
            },
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 201
        results = resp.json()["data"]
        assert len(results) == 3
        assert results[0]["status"] == "skipped"
        assert results[0]["reason"] == "already_exists"
        assert results[1]["status"] == "invited"
        assert results[2]["status"] == "invited"
        assert len(mailoutbox) == 2  # only the 2 new ones

    def test_bulk_invite_empty_rows_returns_400(self, client, admin_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            "/api/v1/users/bulk-invite",
            {"rows": []},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 400

    def test_bulk_invite_participant_returns_403(self, client, admin_user, participant_user):
        h = _auth(client, "part@test.com", "pass123")
        resp = client.post(
            "/api/v1/users/bulk-invite",
            {"rows": [{"email": "x@test.com", "full_name": "X", "role": "PARTICIPANT"}]},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 403


# ------------------------------------------------------------------ #
# GET /api/v1/users/:id                                                #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestUserDetail:
    def test_retrieve_returns_user_with_groups(self, client, admin_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.get(f"/api/v1/users/{admin_user.id}", **h)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "admin@test.com"
        assert "groups" in data
        assert isinstance(data["groups"], list)

    def test_retrieve_participant_returns_403(self, client, admin_user, participant_user):
        h = _auth(client, "part@test.com", "pass123")
        resp = client.get(f"/api/v1/users/{admin_user.id}", **h)
        assert resp.status_code == 403


# ------------------------------------------------------------------ #
# PATCH /api/v1/users/:id                                              #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestUserUpdate:
    def test_partial_update_role(self, client, admin_user, participant_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.patch(
            f"/api/v1/users/{participant_user.id}",
            {"role": "ADMIN"},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["role"] == "ADMIN"
        participant_user.refresh_from_db()
        assert participant_user.role == "ADMIN"

    def test_partial_update_full_name(self, client, admin_user, participant_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.patch(
            f"/api/v1/users/{participant_user.id}",
            {"full_name": "Updated Name"},
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["full_name"] == "Updated Name"


# ------------------------------------------------------------------ #
# DELETE /api/v1/users/:id                                             #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestUserDestroy:
    def test_destroy_deactivates_user(self, client, admin_user, participant_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.delete(f"/api/v1/users/{participant_user.id}", **h)
        assert resp.status_code == 204
        participant_user.refresh_from_db()
        assert not participant_user.is_active
        assert User.objects.filter(pk=participant_user.pk).exists()  # soft delete

    def test_destroy_own_account_returns_400(self, client, admin_user):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.delete(f"/api/v1/users/{admin_user.id}", **h)
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "user.self_deactivate"


# ------------------------------------------------------------------ #
# POST /api/v1/users/:id/resend-invite                                 #
# ------------------------------------------------------------------ #


@pytest.mark.django_db
class TestResendInvite:
    def test_resend_invite_for_pending_user(self, client, admin_user, pending_user, mailoutbox):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            f"/api/v1/users/{pending_user.id}/resend-invite",
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["detail"] == "Invite resent."
        assert len(mailoutbox) == 1
        assert "pending@test.com" in mailoutbox[0].recipients()

    def test_resend_invite_for_active_user_returns_400(
        self, client, admin_user, participant_user
    ):
        h = _auth(client, "admin@test.com", "pass123")
        resp = client.post(
            f"/api/v1/users/{participant_user.id}/resend-invite",
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 400
        assert resp.json()["errors"][0]["code"] == "user.already_active"

    def test_resend_invite_participant_returns_403(
        self, client, admin_user, participant_user, pending_user
    ):
        h = _auth(client, "part@test.com", "pass123")
        resp = client.post(
            f"/api/v1/users/{pending_user.id}/resend-invite",
            content_type="application/json",
            **h,
        )
        assert resp.status_code == 403
