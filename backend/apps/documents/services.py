from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import log_action
from apps.notifications.services import create_inapp

from .models import Document, ParticipantSharedDoc


def document_visible_to(doc: Document, user) -> bool:
    """Visibility matrix:
    GROUP           → all group members + Admin + Instructor-of-group
    SELECTED        → only users in allowed_user_ids + Admin + Instructor-of-group
    STAFF_ONLY      → Admin + Instructor-of-group only
    PUBLIC_TO_CLASS → anyone in any group linked to this doc's class
    """
    if user.role == "ADMIN":
        return True

    if user.role == "INSTRUCTOR":
        from apps.groups.models import GroupInstructor  # noqa: PLC0415
        return GroupInstructor.objects.filter(instructor=user, group_id=doc.group_id).exists()

    if doc.visibility == Document.VIS_STAFF_ONLY:
        return False

    if doc.visibility == Document.VIS_GROUP:
        from apps.groups.models import GroupMembership  # local import to avoid circular
        return GroupMembership.objects.filter(group=doc.group, user=user).exists()

    if doc.visibility == Document.VIS_SELECTED:
        return str(user.id) in doc.allowed_user_ids

    if doc.visibility == Document.VIS_PUBLIC_TO_CLASS:
        if doc.class_obj_id is None:
            return False
        from apps.groups.models import GroupMembership
        return GroupMembership.objects.filter(
            group__classes=doc.class_obj, user=user
        ).exists()

    return False


@transaction.atomic
def approve_shared(
    shared: ParticipantSharedDoc,
    visibility: str,
    allowed_user_ids: list[str],
    actor,
) -> Document:
    if shared.status != ParticipantSharedDoc.STATUS_PENDING:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({"status": "Only PENDING shared docs can be approved."})

    document = Document.objects.create(
        group=shared.group,
        title=shared.title,
        file_url=shared.file_url,
        file_name=shared.file_name,
        file_type=shared.file_type,
        file_size=shared.file_size,
        doc_type=Document.GUIDE,
        visibility=visibility,
        allowed_user_ids=list(allowed_user_ids),
        uploaded_by=shared.uploaded_by,
    )

    shared.status = ParticipantSharedDoc.STATUS_APPROVED
    shared.reviewed_by = actor
    shared.reviewed_at = timezone.now()
    shared.resulting_document = document
    shared.save(update_fields=["status", "reviewed_by", "reviewed_at", "resulting_document"])

    log_action(
        actor=actor,
        action="shared_doc.approved",
        target_type="ParticipantSharedDoc",
        target_id=shared.id,
        metadata={
            "document_id": str(document.id),
            "visibility": visibility,
            "uploader_id": str(shared.uploaded_by_id),
        },
    )

    # Stub notification — B-09 wires real implementation
    create_inapp(
        user=shared.uploaded_by,
        type="SHARED_DOC_RESULT",
        title="Your shared document was approved",
        body=f'"{shared.title}" has been approved and is now visible.',
        link="/me/documents",
        dedupe_key=f"shared_doc_approved:{shared.id}",
        payload={"document_id": str(document.id)},
    )

    return document


@transaction.atomic
def reject_shared(
    shared: ParticipantSharedDoc,
    reason: str,
    actor,
) -> ParticipantSharedDoc:
    if shared.status != ParticipantSharedDoc.STATUS_PENDING:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({"status": "Only PENDING shared docs can be rejected."})

    shared.status = ParticipantSharedDoc.STATUS_REJECTED
    shared.reviewed_by = actor
    shared.reviewed_at = timezone.now()
    shared.rejection_reason = reason
    shared.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason"])

    log_action(
        actor=actor,
        action="shared_doc.rejected",
        target_type="ParticipantSharedDoc",
        target_id=shared.id,
        metadata={
            "reason": reason,
            "uploader_id": str(shared.uploaded_by_id),
        },
    )

    # Stub notification — B-09 wires real implementation
    create_inapp(
        user=shared.uploaded_by,
        type="SHARED_DOC_RESULT",
        title="Your shared document was not approved",
        body=f'"{shared.title}" was rejected. Reason: {reason}',
        link="/me/documents",
        dedupe_key=f"shared_doc_rejected:{shared.id}",
        payload={"reason": reason},
    )

    return shared
