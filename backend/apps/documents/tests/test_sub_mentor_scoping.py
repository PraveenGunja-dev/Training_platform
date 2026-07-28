"""Chunk 02 — Sub-Mentor scoping tests for the documents app."""
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.documents.models import Document, ParticipantSharedDoc
from apps.groups.models import ClassGroup, GroupSubMentor

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(email="admin@doc.s.test", password="pass", full_name="Admin", role="ADMIN")


@pytest.fixture
def sub_mentor(db):
    return User.objects.create_user(email="ins@doc.s.test", password="pass", full_name="Sub-Mentor", role="SUB_MENTOR")


@pytest.fixture
def participant(db):
    return User.objects.create_user(email="part@doc.s.test", password="pass", full_name="Participant", role="PARTICIPANT")


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def sub_mentor_client(sub_mentor):
    c = APIClient()
    c.force_authenticate(user=sub_mentor)
    return c


@pytest.fixture
def participant_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def group_a(db, admin):
    return ClassGroup.objects.create(name="Doc Group A", created_by=admin)


@pytest.fixture
def group_b(db, admin):
    return ClassGroup.objects.create(name="Doc Group B", created_by=admin)


@pytest.fixture
def assigned(group_a, sub_mentor, admin):
    return GroupSubMentor.objects.create(group=group_a, sub_mentor=sub_mentor, assigned_by=admin)


@pytest.fixture
def doc_a(db, group_a, admin):
    return Document.objects.create(
        group=group_a,
        title="Doc in A",
        file_data=b"doc-a",
        file_name="doc-a.pdf",
        file_type="application/pdf",
        file_size=1024,
        doc_type=Document.GUIDE,
        visibility=Document.VIS_GROUP,
        uploaded_by=admin,
    )


@pytest.fixture
def doc_b(db, group_b, admin):
    return Document.objects.create(
        group=group_b,
        title="Doc in B",
        file_data=b"doc-b",
        file_name="doc-b.pdf",
        file_type="application/pdf",
        file_size=1024,
        doc_type=Document.GUIDE,
        visibility=Document.VIS_GROUP,
        uploaded_by=admin,
    )


@pytest.fixture
def shared_a(db, group_a, participant):
    return ParticipantSharedDoc.objects.create(
        group=group_a,
        uploaded_by=participant,
        title="Shared in A",
        file_data=b"shared-a",
        file_name="shared-a.pdf",
        file_type="application/pdf",
        file_size=512,
        suggested_visibility=Document.VIS_GROUP,
    )


@pytest.fixture
def shared_b(db, group_b, participant):
    return ParticipantSharedDoc.objects.create(
        group=group_b,
        uploaded_by=participant,
        title="Shared in B",
        file_data=b"shared-b",
        file_name="shared-b.pdf",
        file_type="application/pdf",
        file_size=512,
        suggested_visibility=Document.VIS_GROUP,
    )


# ---------------------------------------------------------------------------
# List documents
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDocumentList:
    def test_admin_sees_all_docs(self, admin_client, doc_a, doc_b):
        resp = admin_client.get("/training/api/v1/documents")
        assert resp.status_code == 200
        titles = {d["title"] for d in resp.json()["data"]}
        assert "Doc in A" in titles
        assert "Doc in B" in titles

    def test_sub_mentor_no_assignment_sees_empty(self, sub_mentor_client, doc_a):
        resp = sub_mentor_client.get("/training/api/v1/documents")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_sub_mentor_assigned_sees_only_own_docs(self, sub_mentor_client, assigned, doc_a, doc_b):
        resp = sub_mentor_client.get("/training/api/v1/documents")
        assert resp.status_code == 200
        titles = {d["title"] for d in resp.json()["data"]}
        assert "Doc in A" in titles
        assert "Doc in B" not in titles


# ---------------------------------------------------------------------------
# Retrieve document
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDocumentRetrieve:
    def test_sub_mentor_retrieves_doc_in_assigned_group(self, sub_mentor_client, assigned, doc_a):
        resp = sub_mentor_client.get(f"/training/api/v1/documents/{doc_a.id}")
        assert resp.status_code == 200

    def test_sub_mentor_cannot_retrieve_doc_in_unassigned_group(self, sub_mentor_client, doc_b):
        resp = sub_mentor_client.get(f"/training/api/v1/documents/{doc_b.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Create document
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDocumentCreate:
    def _payload(self, group_id):
        return {
            "group_id": str(group_id),
            "title": "New Doc",
            "file": SimpleUploadedFile("new.pdf", b"new", content_type="application/pdf"),
            "doc_type": "GUIDE",
            "visibility": "GROUP",
        }

    def test_sub_mentor_can_create_doc_in_assigned_group(self, sub_mentor_client, assigned, group_a):
        resp = sub_mentor_client.post("/training/api/v1/documents", self._payload(group_a.id), format="multipart")
        assert resp.status_code == 201

    def test_sub_mentor_cannot_create_doc_in_unassigned_group(self, sub_mentor_client, group_b):
        resp = sub_mentor_client.post("/training/api/v1/documents", self._payload(group_b.id), format="multipart")
        assert resp.status_code == 403

    def test_participant_cannot_create_doc(self, participant_client, group_a):
        resp = participant_client.post("/training/api/v1/documents", self._payload(group_a.id), format="multipart")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update / Delete document
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDocumentWriteScoping:
    def test_sub_mentor_can_update_doc_in_assigned_group(self, sub_mentor_client, assigned, doc_a):
        resp = sub_mentor_client.patch(f"/training/api/v1/documents/{doc_a.id}", {"title": "Updated"}, format="json")
        assert resp.status_code == 200

    def test_sub_mentor_cannot_update_doc_in_unassigned_group(self, sub_mentor_client, doc_b):
        resp = sub_mentor_client.patch(f"/training/api/v1/documents/{doc_b.id}", {"title": "Hacked"}, format="json")
        assert resp.status_code == 403

    def test_sub_mentor_can_delete_doc_in_assigned_group(self, sub_mentor_client, assigned, doc_a):
        resp = sub_mentor_client.delete(f"/training/api/v1/documents/{doc_a.id}")
        assert resp.status_code == 204

    def test_sub_mentor_cannot_delete_doc_in_unassigned_group(self, sub_mentor_client, doc_b):
        resp = sub_mentor_client.delete(f"/training/api/v1/documents/{doc_b.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Shared uploads queue
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSharedUploads:
    def test_sub_mentor_sees_only_assigned_group_pending_uploads(
        self, sub_mentor_client, assigned, shared_a, shared_b
    ):
        resp = sub_mentor_client.get("/training/api/v1/admin/shared-uploads/pending")
        assert resp.status_code == 200
        titles = {d["title"] for d in resp.json()["data"]}
        assert "Shared in A" in titles
        assert "Shared in B" not in titles

    def test_sub_mentor_can_reject_shared_upload_in_assigned_group(
        self, sub_mentor_client, assigned, shared_a
    ):
        resp = sub_mentor_client.post(
            f"/training/api/v1/admin/shared-uploads/{shared_a.id}/reject",
            {"reason": "Not relevant"},
            format="json",
        )
        assert resp.status_code == 200

    def test_sub_mentor_cannot_reject_shared_upload_in_unassigned_group(
        self, sub_mentor_client, shared_b
    ):
        resp = sub_mentor_client.post(
            f"/training/api/v1/admin/shared-uploads/{shared_b.id}/reject",
            {"reason": "Trying"},
            format="json",
        )
        assert resp.status_code == 403

    def test_participant_cannot_access_pending_queue(self, participant_client):
        resp = participant_client.get("/training/api/v1/admin/shared-uploads/pending")
        assert resp.status_code == 403
