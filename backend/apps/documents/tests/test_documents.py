"""Tests for the documents app (B-07).

Covers:
- Document CRUD (Admin only create/update/delete)
- Visibility filtering: GROUP, SELECTED, STAFF_ONLY, PUBLIC_TO_CLASS
- Download endpoint: permission check + mock URL returned
- Upload permissions: Admin grants/revokes; Participant sees own
- Shared upload: POST (with / without permission → 403)
- Admin queue: GET /admin/shared-uploads/pending
- Approve: status APPROVED, Document created, audit written
- Reject: status REJECTED, reason required (400 if empty)
- Notification stub called (no-op, no crash)
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class

from apps.documents.models import Document, ParticipantSharedDoc, ParticipantUploadPermission

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email="admin@docs.test", password="pass", full_name="Admin Docs", role="ADMIN"
    )


@pytest.fixture
def participant(db):
    return User.objects.create_user(
        email="part@docs.test", password="pass", full_name="Part Docs", role="PARTICIPANT"
    )


@pytest.fixture
def participant2(db):
    return User.objects.create_user(
        email="part2@docs.test", password="pass", full_name="Part2 Docs", role="PARTICIPANT"
    )


@pytest.fixture
def group(db, admin):
    return ClassGroup.objects.create(name="DocGroup", created_by=admin)


@pytest.fixture
def group2(db, admin):
    return ClassGroup.objects.create(name="DocGroup2", created_by=admin)


@pytest.fixture
def membership(db, participant, group):
    return GroupMembership.objects.create(user=participant, group=group)


@pytest.fixture
def admin_client(admin):
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.fixture
def part_client(participant):
    c = APIClient()
    c.force_authenticate(user=participant)
    return c


@pytest.fixture
def part2_client(participant2):
    c = APIClient()
    c.force_authenticate(user=participant2)
    return c


def make_doc(group, visibility=Document.VIS_GROUP, allowed_user_ids=None, uploaded_by=None):
    return Document.objects.create(
        group=group,
        title="Test Doc",
        file_url="blob://test/file.pdf",
        file_name="file.pdf",
        file_type="application/pdf",
        file_size=1024,
        doc_type=Document.SLIDES,
        visibility=visibility,
        allowed_user_ids=allowed_user_ids or [],
        uploaded_by=uploaded_by,
    )


# ---------------------------------------------------------------------------
# Document CRUD
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_create_document(admin_client, group):
    resp = admin_client.post("/api/v1/documents", {
        "group_id": str(group.id),
        "title": "New Doc",
        "file_url": "blob://test/new.pdf",
        "file_name": "new.pdf",
        "file_type": "application/pdf",
        "file_size": 2048,
        "doc_type": "SLIDES",
        "visibility": "GROUP",
        "allowed_user_ids": [],
    }, format="json")
    assert resp.status_code == 201
    assert resp.data["data"]["title"] == "New Doc"
    assert AuditLog.objects.filter(action="document.created").exists()


@pytest.mark.django_db
def test_participant_cannot_create_document(part_client, group):
    resp = part_client.post("/api/v1/documents", {
        "group_id": str(group.id),
        "title": "Sneaky Doc",
        "file_url": "blob://x/x.pdf",
        "file_name": "x.pdf",
        "file_type": "application/pdf",
        "file_size": 100,
        "doc_type": "GUIDE",
        "visibility": "GROUP",
    }, format="json")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_update_document(admin_client, group):
    doc = make_doc(group)
    resp = admin_client.patch(f"/api/v1/documents/{doc.id}", {"title": "Updated"}, format="json")
    assert resp.status_code == 200
    assert resp.data["data"]["title"] == "Updated"


@pytest.mark.django_db
def test_admin_delete_document(admin_client, group):
    doc = make_doc(group)
    resp = admin_client.delete(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 204
    assert not Document.objects.filter(id=doc.id).exists()


# ---------------------------------------------------------------------------
# Visibility: GROUP
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_group_doc_visible_to_member(part_client, group, participant, membership):
    doc = make_doc(group, visibility=Document.VIS_GROUP)
    resp = part_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_group_doc_hidden_from_non_member(part2_client, group):
    doc = make_doc(group, visibility=Document.VIS_GROUP)
    resp = part2_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Visibility: SELECTED
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_selected_doc_visible_to_allowed_user(part_client, group, participant, membership):
    doc = make_doc(group, visibility=Document.VIS_SELECTED, allowed_user_ids=[str(participant.id)])
    resp = part_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_selected_doc_hidden_from_other_member(part2_client, group, participant2, group2):
    GroupMembership.objects.create(user=participant2, group=group)
    doc = make_doc(group, visibility=Document.VIS_SELECTED, allowed_user_ids=["some-other-uuid"])
    resp = part2_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Visibility: STAFF_ONLY
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_staff_only_doc_hidden_from_participant(part_client, group, membership):
    doc = make_doc(group, visibility=Document.VIS_STAFF_ONLY)
    resp = part_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_staff_only_doc_visible_to_admin(admin_client, group):
    doc = make_doc(group, visibility=Document.VIS_STAFF_ONLY)
    resp = admin_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Download endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_download_returns_mock_url(admin_client, group):
    doc = make_doc(group, visibility=Document.VIS_STAFF_ONLY)
    resp = admin_client.get(f"/api/v1/documents/{doc.id}/download")
    assert resp.status_code == 200
    assert "download_url" in resp.data["data"]
    assert resp.data["data"]["download_url"].startswith("mock://")


@pytest.mark.django_db
def test_download_denied_for_hidden_doc(part_client, group):
    doc = make_doc(group, visibility=Document.VIS_STAFF_ONLY)
    resp = part_client.get(f"/api/v1/documents/{doc.id}/download")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Upload permissions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_grant_upload_permission(admin_client, group, participant):
    resp = admin_client.post(
        f"/api/v1/admin/groups/{group.id}/upload-permissions",
        {"user_id": str(participant.id)},
        format="json",
    )
    assert resp.status_code == 201
    assert ParticipantUploadPermission.objects.filter(user=participant, group=group).exists()


@pytest.mark.django_db
def test_admin_grant_duplicate_upload_permission(admin_client, group, participant):
    ParticipantUploadPermission.objects.create(user=participant, group=group)
    resp = admin_client.post(
        f"/api/v1/admin/groups/{group.id}/upload-permissions",
        {"user_id": str(participant.id)},
        format="json",
    )
    assert resp.status_code == 409


@pytest.mark.django_db
def test_admin_revoke_upload_permission(admin_client, group, participant):
    ParticipantUploadPermission.objects.create(user=participant, group=group)
    resp = admin_client.delete(
        f"/api/v1/admin/groups/{group.id}/upload-permissions/{participant.id}"
    )
    assert resp.status_code == 204
    assert not ParticipantUploadPermission.objects.filter(user=participant, group=group).exists()


@pytest.mark.django_db
def test_me_upload_permissions(part_client, participant, group, group2):
    ParticipantUploadPermission.objects.create(user=participant, group=group)
    resp = part_client.get("/api/v1/me/upload-permissions")
    assert resp.status_code == 200
    assert len(resp.data["data"]) == 1
    assert str(resp.data["data"][0]["group_id"]) == str(group.id)


# ---------------------------------------------------------------------------
# Shared uploads
# ---------------------------------------------------------------------------


@pytest.fixture
def upload_payload():
    return {
        "title": "My Study Notes",
        "file_url": "blob://shared/notes.pdf",
        "file_name": "notes.pdf",
        "file_type": "application/pdf",
        "file_size": 512,
        "suggested_visibility": "GROUP",
        "suggested_user_ids": [],
    }


@pytest.mark.django_db
def test_participant_with_permission_can_shared_upload(
    part_client, group, participant, membership, upload_payload
):
    ParticipantUploadPermission.objects.create(user=participant, group=group)
    resp = part_client.post(
        f"/api/v1/groups/{group.id}/shared-uploads", upload_payload, format="json"
    )
    assert resp.status_code == 201
    assert resp.data["data"]["status"] == "PENDING"
    assert AuditLog.objects.filter(action="shared_doc.uploaded").exists()


@pytest.mark.django_db
def test_participant_without_permission_cannot_shared_upload(
    part_client, group, upload_payload
):
    resp = part_client.post(
        f"/api/v1/groups/{group.id}/shared-uploads", upload_payload, format="json"
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Admin queue + approve/reject
# ---------------------------------------------------------------------------


@pytest.fixture
def pending_shared(db, participant, group):
    return ParticipantSharedDoc.objects.create(
        group=group,
        uploaded_by=participant,
        title="Pending Doc",
        file_url="blob://shared/pending.pdf",
        file_name="pending.pdf",
        file_type="application/pdf",
        file_size=1024,
    )


@pytest.mark.django_db
def test_admin_pending_queue(admin_client, pending_shared):
    resp = admin_client.get("/api/v1/admin/shared-uploads/pending")
    assert resp.status_code == 200
    assert len(resp.data["data"]) == 1
    assert resp.data["data"][0]["status"] == "PENDING"


@pytest.mark.django_db
def test_admin_approve_shared_upload(admin_client, pending_shared):
    resp = admin_client.post(
        f"/api/v1/admin/shared-uploads/{pending_shared.id}/approve",
        {"visibility": "GROUP", "allowed_user_ids": []},
        format="json",
    )
    assert resp.status_code == 200
    pending_shared.refresh_from_db()
    assert pending_shared.status == "APPROVED"
    assert pending_shared.resulting_document is not None
    doc = Document.objects.get(id=pending_shared.resulting_document_id)
    assert doc.title == "Pending Doc"
    assert AuditLog.objects.filter(action="shared_doc.approved").exists()


@pytest.mark.django_db
def test_admin_approve_creates_document_with_correct_visibility(admin_client, pending_shared, participant):
    resp = admin_client.post(
        f"/api/v1/admin/shared-uploads/{pending_shared.id}/approve",
        {"visibility": "SELECTED", "allowed_user_ids": [str(participant.id)]},
        format="json",
    )
    assert resp.status_code == 200
    doc = Document.objects.get(title="Pending Doc")
    assert doc.visibility == "SELECTED"
    assert str(participant.id) in doc.allowed_user_ids


@pytest.mark.django_db
def test_admin_reject_requires_reason(admin_client, pending_shared):
    resp = admin_client.post(
        f"/api/v1/admin/shared-uploads/{pending_shared.id}/reject",
        {"reason": ""},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_admin_reject_shared_upload(admin_client, pending_shared):
    resp = admin_client.post(
        f"/api/v1/admin/shared-uploads/{pending_shared.id}/reject",
        {"reason": "Not relevant to the class."},
        format="json",
    )
    assert resp.status_code == 200
    pending_shared.refresh_from_db()
    assert pending_shared.status == "REJECTED"
    assert pending_shared.rejection_reason == "Not relevant to the class."
    assert AuditLog.objects.filter(action="shared_doc.rejected").exists()


@pytest.mark.django_db
def test_cannot_approve_already_approved(admin_client, pending_shared):
    pending_shared.status = "APPROVED"
    pending_shared.save()
    resp = admin_client.post(
        f"/api/v1/admin/shared-uploads/{pending_shared.id}/approve",
        {"visibility": "GROUP"},
        format="json",
    )
    assert resp.status_code == 409


@pytest.mark.django_db
def test_cannot_reject_already_rejected(admin_client, pending_shared):
    pending_shared.status = "REJECTED"
    pending_shared.save()
    resp = admin_client.post(
        f"/api/v1/admin/shared-uploads/{pending_shared.id}/reject",
        {"reason": "Already done."},
        format="json",
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Document list scoping
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_document_list_shows_visible_docs_to_participant(
    part_client, group, participant, membership
):
    make_doc(group, visibility=Document.VIS_GROUP)
    make_doc(group, visibility=Document.VIS_STAFF_ONLY)
    resp = part_client.get("/api/v1/documents")
    assert resp.status_code == 200
    # Only the GROUP doc should be visible
    assert len(resp.data["data"]) == 1
    assert resp.data["data"][0]["visibility"] == "GROUP"


@pytest.mark.django_db
def test_document_list_admin_sees_all(admin_client, group):
    make_doc(group, visibility=Document.VIS_GROUP)
    make_doc(group, visibility=Document.VIS_STAFF_ONLY)
    resp = admin_client.get("/api/v1/documents")
    assert resp.status_code == 200
    assert len(resp.data["data"]) == 2


# ---------------------------------------------------------------------------
# Visibility: PUBLIC_TO_CLASS
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_public_to_class_visible_to_member_of_linked_group(
    part_client, group, participant, admin, membership
):
    now = timezone.now()
    cls = Class.objects.create(
        group=group,
        title="Test Class",
        starts_at=now,
        ends_at=now + timedelta(hours=1),
        created_by=admin,
    )
    doc = Document.objects.create(
        group=group,
        class_obj=cls,
        title="Class Doc",
        file_url="blob://x/x.pdf",
        file_name="x.pdf",
        file_type="application/pdf",
        file_size=100,
        visibility=Document.VIS_PUBLIC_TO_CLASS,
        uploaded_by=admin,
    )
    # participant is in group which is linked to cls → should be visible
    resp = part_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_public_to_class_hidden_when_no_class_linked(
    part_client, group, participant, membership
):
    # no class_obj → hidden for participants
    doc = Document.objects.create(
        group=group,
        class_obj=None,
        title="Orphan Class Doc",
        file_url="blob://x/orphan.pdf",
        file_name="orphan.pdf",
        file_type="application/pdf",
        file_size=100,
        visibility=Document.VIS_PUBLIC_TO_CLASS,
    )
    resp = part_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_public_to_class_hidden_from_user_not_in_group(
    part2_client, participant2, group, admin
):
    now = timezone.now()
    cls = Class.objects.create(
        group=group,
        title="Test Class 2",
        starts_at=now,
        ends_at=now + timedelta(hours=1),
        created_by=admin,
    )
    doc = Document.objects.create(
        group=group,
        class_obj=cls,
        title="Class Doc 2",
        file_url="blob://x/x2.pdf",
        file_name="x2.pdf",
        file_type="application/pdf",
        file_size=100,
        visibility=Document.VIS_PUBLIC_TO_CLASS,
        uploaded_by=admin,
    )
    # participant2 is NOT in group → hidden
    resp = part2_client.get(f"/api/v1/documents/{doc.id}")
    assert resp.status_code == 403
