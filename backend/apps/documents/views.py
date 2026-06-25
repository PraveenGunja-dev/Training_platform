from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.services import log_action
from apps.common.file_validation import FileValidationError, validate_file
from apps.common.scoping import instructor_document_qs, instructor_owns_group, instructor_shared_upload_qs
from apps.groups.models import ClassGroup, GroupAdmin, GroupMembership

from .models import Document, ParticipantSharedDoc, ParticipantUploadPermission
from .serializers import (
    ApproveSharedDocSerializer,
    DocumentSerializer,
    DocumentWriteSerializer,
    RejectSharedDocSerializer,
    SharedDocSerializer,
    SharedDocWriteSerializer,
    UploadPermissionSerializer,
)
from .services import approve_shared, document_visible_to, reject_shared

User = get_user_model()


_INSTRUCTOR_DENIED = {
    "errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}],
    "data": None,
}


def _admin_required(request: Request) -> Response | None:
    if request.user.role != "ADMIN":
        return Response(
            {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _staff_required(request: Request) -> Response | None:
    """Allow ADMIN or INSTRUCTOR; deny everyone else."""
    if request.user.role not in ("ADMIN", "INSTRUCTOR"):
        return Response(
            {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _validation_error(errors: dict | str) -> Response:
    return Response(
        {"errors": [{"code": "validation_error", "message": str(errors)}], "data": None},
        status=status.HTTP_400_BAD_REQUEST,
    )


# ---------------------------------------------------------------------------
# DocumentViewSet — CRUD + download
# ---------------------------------------------------------------------------


class DocumentViewSet(ViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentSerializer

    def _base_qs(self):
        return Document.objects.defer('file_data').select_related("group", "class_obj", "uploaded_by")

    # GET /documents
    def list(self, request: Request) -> Response:
        qs = self._base_qs()
        group_id = request.query_params.get("group_id")
        if group_id:
            qs = qs.filter(group_id=group_id)
        if request.user.role == "ADMIN":
            return Response({"data": DocumentSerializer(qs, many=True).data})
        if request.user.role == "INSTRUCTOR":
            qs = instructor_document_qs(request.user).select_related("group", "class_obj", "uploaded_by")
            if group_id:
                qs = qs.filter(group_id=group_id)
            return Response({"data": DocumentSerializer(qs, many=True).data})
        # Participant: filter by visibility rules
        user_group_ids = set(
            GroupMembership.objects.filter(user=request.user).values_list("group_id", flat=True)
        )
        user_id_str = str(request.user.id)
        visible = []
        for doc in qs:
            if doc.visibility == Document.VIS_GROUP:
                if doc.group_id in user_group_ids:
                    visible.append(doc)
            elif doc.visibility == Document.VIS_SELECTED:
                if user_id_str in doc.allowed_user_ids:
                    visible.append(doc)
            elif doc.visibility == Document.VIS_PUBLIC_TO_CLASS:
                if doc.class_obj_id and doc.class_obj and doc.class_obj.group_id in user_group_ids:
                    visible.append(doc)
        return Response({"data": DocumentSerializer(visible, many=True).data})

    # POST /documents (Admin or Instructor on assigned group)
    def create(self, request: Request) -> Response:
        err = _staff_required(request)
        if err:
            return err
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {"errors": [{"code": "validation_error", "message": "A file must be provided."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_name = uploaded_file.name
        file_type = uploaded_file.content_type
        file_size = uploaded_file.size
        try:
            validate_file(file_name, file_size, file_type)
        except FileValidationError as exc:
            return Response(
                {"errors": [{"code": exc.code, "message": exc.message}], "data": None},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        file_bytes = uploaded_file.read()
        ser = DocumentWriteSerializer(data=request.data)
        if not ser.is_valid():
            return _validation_error(ser.errors)
        d = ser.validated_data
        if request.user.role == "INSTRUCTOR":
            group_id = d["group"].pk if d.get("group") else None
            if not group_id or not instructor_owns_group(request.user, group_id):
                return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        doc = Document.objects.create(
            group=d["group"],
            class_obj=d.get("class_obj"),
            title=d["title"],
            description=d.get("description", ""),
            file_data=file_bytes,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
            doc_type=d["doc_type"],
            visibility=d["visibility"],
            allowed_user_ids=list(d.get("allowed_user_ids") or []),
            uploaded_by=request.user,
        )
        log_action(
            actor=request.user,
            action="document.created",
            target_type="Document",
            target_id=doc.id,
            metadata={"title": doc.title, "group_id": str(doc.group_id)},
        )

        # Notify participants when a document is added
        from apps.notifications.models import Notification
        from django.utils import timezone as tz
        now = tz.now()
        _PRESET_LABELS = {
            "GUIDE": "Guide", "SLIDES": "Slides", "TEMPLATE": "Template",
            "REPORT": "Report", "REFERENCE": "Reference", "QUIZ": "Quiz",
            "SCHEDULE": "Schedule", "CASE_STUDY": "Case Study", "MOM": "MOM",
        }
        doc_type_label = _PRESET_LABELS.get(doc.doc_type, doc.doc_type.replace("_", " "))

        if doc.visibility == Document.VIS_STAFF_ONLY:
            pass  # no notification — hidden from participants

        elif doc.visibility == Document.VIS_SELECTED:
            # Always notify only the explicitly chosen users, regardless of class linkage
            recipient_ids = [uid for uid in doc.allowed_user_ids if uid]
            if recipient_ids:
                Notification.objects.bulk_create(
                    [
                        Notification(
                            user_id=uid,
                            type="GROUP_DOCUMENT_ADDED",
                            title=f"New document: {doc.title}",
                            body=f'"{doc.title}" ({doc_type_label}) has been shared with you in {doc.group.name}.',
                            link=f"/me/groups/{doc.group_id}/documents",
                            dedupe_key=f"group_doc_added:{doc.id}:{uid}",
                            sent_at=now,
                            payload={"group_id": str(doc.group_id), "document_id": str(doc.id)},
                        )
                        for uid in recipient_ids
                    ],
                    ignore_conflicts=True,
                    batch_size=500,
                )

        elif doc.class_obj_id:
            # Class-linked document (GROUP or PUBLIC_TO_CLASS) — notify all group members
            from apps.scheduling.models import Class as ClassModel
            try:
                cls_obj = ClassModel.objects.select_related("group").get(pk=doc.class_obj_id)
                member_ids = list(
                    GroupMembership.objects.filter(group=cls_obj.group)
                    .values_list("user_id", flat=True)
                )
                Notification.objects.bulk_create(
                    [
                        Notification(
                            user_id=uid,
                            type="CLASS_DOCUMENT_ADDED",
                            title=f"New document: {doc.title}",
                            body=f'"{doc.title}" ({doc_type_label}) has been added to {cls_obj.title}.',
                            link=f"/me/classes/{cls_obj.id}",
                            dedupe_key=f"class_doc_added:{doc.id}:{uid}",
                            sent_at=now,
                            payload={"class_id": str(cls_obj.id), "document_id": str(doc.id)},
                        )
                        for uid in member_ids
                    ],
                    ignore_conflicts=True,
                    batch_size=500,
                )
            except ClassModel.DoesNotExist:
                pass

        else:
            # Group-level document (GROUP or PUBLIC_TO_CLASS, no class) — notify all group members
            recipient_ids = list(
                GroupMembership.objects.filter(group=doc.group)
                .values_list("user_id", flat=True)
            )
            Notification.objects.bulk_create(
                [
                    Notification(
                        user_id=uid,
                        type="GROUP_DOCUMENT_ADDED",
                        title=f"New document: {doc.title}",
                        body=f'"{doc.title}" ({doc_type_label}) has been added to {doc.group.name}.',
                        link=f"/me/groups/{doc.group_id}/documents",
                        dedupe_key=f"group_doc_added:{doc.id}:{uid}",
                        sent_at=now,
                        payload={"group_id": str(doc.group_id), "document_id": str(doc.id)},
                    )
                    for uid in recipient_ids
                ],
                ignore_conflicts=True,
                batch_size=500,
            )

        return Response({"data": DocumentSerializer(doc).data}, status=status.HTTP_201_CREATED)

    # GET /documents/:id
    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        doc = get_object_or_404(self._base_qs(), pk=pk)
        if not document_visible_to(doc, request.user):
            return Response(
                {"errors": [{"code": "perm.denied", "message": "Access denied."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({"data": DocumentSerializer(doc).data})

    # PATCH /documents/:id (Admin or Instructor on assigned group)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        err = _staff_required(request)
        if err:
            return err
        doc = get_object_or_404(Document, pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, doc.group_id):
            return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        ser = DocumentWriteSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return _validation_error(ser.errors)
        d = ser.validated_data
        for field, value in d.items():
            setattr(doc, field, value)
        doc.save()
        log_action(
            actor=request.user,
            action="document.updated",
            target_type="Document",
            target_id=doc.id,
            metadata={"fields_changed": list(d.keys())},
        )
        return Response({"data": DocumentSerializer(doc).data})

    # DELETE /documents/:id (Admin, Instructor on assigned group, or Group Admin of group)
    def destroy(self, request: Request, pk: str | None = None) -> Response:
        role = request.user.role
        if role not in ("ADMIN", "INSTRUCTOR", "GROUP_ADMIN"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Access denied."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        doc = get_object_or_404(Document, pk=pk)
        if role == "INSTRUCTOR" and not instructor_owns_group(request.user, doc.group_id):
            return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if role == "GROUP_ADMIN" and not GroupAdmin.objects.filter(admin=request.user, group_id=doc.group_id).exists():
            return Response(
                {"errors": [{"code": "perm.not_group_admin", "message": "You are not the admin of this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        doc_id = doc.id
        doc.delete()
        log_action(
            actor=request.user,
            action="document.deleted",
            target_type="Document",
            target_id=doc_id,
            metadata={},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET /documents/:id/file
    def file(self, request: Request, pk: str | None = None) -> Response:
        doc = get_object_or_404(
            Document.objects.only('id', 'file_data', 'file_name', 'file_type', 'group', 'class_obj', 'visibility', 'allowed_user_ids', 'uploaded_by'),
            pk=pk
        )
        if not document_visible_to(doc, request.user):
            return Response(
                {"errors": [{"code": "perm.denied", "message": "Access denied."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not doc.file_data:
            return Response(
                {"errors": [{"code": "not_found", "message": "File not available."}], "data": None},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.http import HttpResponse
        import urllib.parse
        response = HttpResponse(bytes(doc.file_data), content_type=doc.file_type)
        safe_name = urllib.parse.quote(doc.file_name)
        response['Content-Disposition'] = f'attachment; filename="{doc.file_name}"; filename*=UTF-8\'\'{safe_name}'
        response['Content-Length'] = len(doc.file_data)
        return response


# ---------------------------------------------------------------------------
# Admin: upload permissions on a group
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class GroupUploadPermissionView(APIView):
    permission_classes = [IsAuthenticated]

    # POST /admin/groups/:group_id/upload-permissions
    def post(self, request: Request, group_id: str) -> Response:
        err = _admin_required(request)
        if err:
            return err
        group = get_object_or_404(ClassGroup, pk=group_id)
        user_id = request.data.get("user_id")
        if not user_id:
            return _validation_error({"user_id": "This field is required."})
        user = get_object_or_404(User, pk=user_id)

        perm, created = ParticipantUploadPermission.objects.get_or_create(
            user=user, group=group, defaults={"granted_by": request.user}
        )
        if not created:
            return Response(
                {"errors": [{"code": "perm.already_granted", "message": "Permission already exists."}], "data": None},
                status=status.HTTP_409_CONFLICT,
            )
        log_action(
            actor=request.user,
            action="upload_permission.granted",
            target_type="ParticipantUploadPermission",
            target_id=perm.id,
            metadata={"user_id": str(user.id), "group_id": str(group.id)},
        )
        return Response({"data": UploadPermissionSerializer(perm).data}, status=status.HTTP_201_CREATED)


@extend_schema(exclude=True)
class GroupUploadPermissionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    # DELETE /admin/groups/:group_id/upload-permissions/:user_id
    def delete(self, request: Request, group_id: str, user_id: str) -> Response:
        err = _admin_required(request)
        if err:
            return err
        group = get_object_or_404(ClassGroup, pk=group_id)
        user = get_object_or_404(User, pk=user_id)
        deleted, _ = ParticipantUploadPermission.objects.filter(
            user=user, group=group
        ).delete()
        if deleted:
            log_action(
                actor=request.user,
                action="upload_permission.revoked",
                target_type="ParticipantUploadPermission",
                target_id=None,
                metadata={"user_id": str(user.id), "group_id": str(group.id)},
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Participant: /me/upload-permissions
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class MeUploadPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        perms = (
            ParticipantUploadPermission.objects.filter(user=request.user)
            .select_related("group", "granted_by")
        )
        return Response({"data": UploadPermissionSerializer(perms, many=True).data})


@extend_schema(exclude=True)
class MeSharedUploadsView(APIView):
    """GET /me/shared-uploads — participant's own shared doc submissions."""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = (
            ParticipantSharedDoc.objects.filter(uploaded_by=request.user)
            .select_related("group", "uploaded_by")
            .order_by("-created_at")
        )
        return Response({"data": SharedDocSerializer(qs, many=True).data})


# ---------------------------------------------------------------------------
# Participant: POST /groups/:group_id/shared-uploads
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class GroupSharedUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: str) -> Response:
        group = get_object_or_404(ClassGroup, pk=group_id)

        # Verify live group membership first
        is_member = GroupMembership.objects.filter(user=request.user, group=group).exists()
        if not is_member:
            return Response(
                {"errors": [{"code": "perm.not_in_group", "message": "You are not a member of this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Verify upload permission grant
        has_perm = ParticipantUploadPermission.objects.filter(
            user=request.user, group=group
        ).exists()
        if not has_perm:
            return Response(
                {"errors": [{"code": "perm.upload_not_permitted", "message": "You do not have upload permission for this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cooldown: prevent re-flooding the approval queue after rejection
        from django.utils import timezone as _tz  # noqa: PLC0415
        from datetime import timedelta  # noqa: PLC0415
        cooldown_cutoff = _tz.now() - timedelta(hours=1)
        recent_rejection = ParticipantSharedDoc.objects.filter(
            uploaded_by=request.user,
            group=group,
            status=ParticipantSharedDoc.STATUS_REJECTED,
            updated_at__gte=cooldown_cutoff,
        ).exists()
        if recent_rejection:
            return Response(
                {"errors": [{"code": "shared_doc.cooldown", "message": "Please wait 1 hour after a rejection before re-submitting."}], "data": None},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {"errors": [{"code": "validation_error", "message": "A file must be provided."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_name = uploaded_file.name
        file_type = uploaded_file.content_type
        file_size = uploaded_file.size
        try:
            validate_file(file_name, file_size, file_type)
        except FileValidationError as exc:
            return Response(
                {"errors": [{"code": exc.code, "message": exc.message}], "data": None},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        file_bytes = uploaded_file.read()

        ser = SharedDocWriteSerializer(data=request.data)
        if not ser.is_valid():
            return _validation_error(ser.errors)
        d = ser.validated_data

        shared = ParticipantSharedDoc.objects.create(
            group=group,
            uploaded_by=request.user,
            title=d["title"],
            file_data=file_bytes,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
            suggested_visibility=d["suggested_visibility"],
            suggested_user_ids=list(d.get("suggested_user_ids") or []),
        )
        log_action(
            actor=request.user,
            action="shared_doc.uploaded",
            target_type="ParticipantSharedDoc",
            target_id=shared.id,
            metadata={"group_id": str(group.id), "title": shared.title},
        )
        from apps.notifications.services import notify_instructors as _ni_doc  # noqa: PLC0415
        uploader_name = request.user.full_name or request.user.email
        _ni_doc(
            group=group,
            notification_type="SHARED_UPLOAD_PENDING",
            title=f"Shared upload pending approval: {shared.title}",
            body=f"{uploader_name} is requesting approval for a shared upload in {group.name}.",
            link="/instructor/shared-uploads",
            payload={"shared_doc_id": str(shared.id), "group_id": str(group.id)},
            dedupe_suffix=str(shared.id),
        )
        return Response({"data": SharedDocSerializer(shared).data}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Admin: shared-uploads queue
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class AdminSharedUploadListView(APIView):
    permission_classes = [IsAuthenticated]

    # GET /admin/shared-uploads/pending
    def get(self, request: Request) -> Response:
        err = _staff_required(request)
        if err:
            return err
        if request.user.role == "INSTRUCTOR":
            qs = instructor_shared_upload_qs(request.user).filter(
                status=ParticipantSharedDoc.STATUS_PENDING
            ).select_related("group", "uploaded_by").order_by("created_at")
        else:
            qs = (
                ParticipantSharedDoc.objects.filter(status=ParticipantSharedDoc.STATUS_PENDING)
                .select_related("group", "uploaded_by")
                .order_by("created_at")
            )
        return Response({"data": SharedDocSerializer(qs, many=True).data})


@extend_schema(exclude=True)
class AdminSharedUploadApproveView(APIView):
    permission_classes = [IsAuthenticated]

    # POST /admin/shared-uploads/:id/approve
    def post(self, request: Request, pk: str) -> Response:
        err = _staff_required(request)
        if err:
            return err
        shared = get_object_or_404(
            ParticipantSharedDoc.objects.select_related("group", "uploaded_by"), pk=pk
        )
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, shared.group_id):
            return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if shared.uploaded_by_id == request.user.id:
            return Response(
                {"errors": [{"code": "shared_doc.self_approval", "message": "You cannot approve your own shared upload."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        if shared.status != ParticipantSharedDoc.STATUS_PENDING:
            return Response(
                {"errors": [{"code": "shared_doc.not_pending", "message": "Only PENDING uploads can be approved."}], "data": None},
                status=status.HTTP_409_CONFLICT,
            )

        ser = ApproveSharedDocSerializer(data=request.data)
        if not ser.is_valid():
            return _validation_error(ser.errors)
        d = ser.validated_data

        from rest_framework.exceptions import ValidationError as DRFValidationError
        try:
            document = approve_shared(
                shared=shared,
                visibility=d["visibility"],
                allowed_user_ids=d.get("allowed_user_ids") or [],
                actor=request.user,
            )
        except DRFValidationError as exc:
            return _validation_error(exc.detail)

        return Response({
            "data": {
                "shared_doc": SharedDocSerializer(shared).data,
                "document": DocumentSerializer(document).data,
            }
        })


@extend_schema(exclude=True)
class AdminSharedUploadRejectView(APIView):
    permission_classes = [IsAuthenticated]

    # POST /admin/shared-uploads/:id/reject
    def post(self, request: Request, pk: str) -> Response:
        err = _staff_required(request)
        if err:
            return err
        shared = get_object_or_404(
            ParticipantSharedDoc.objects.select_related("group", "uploaded_by"), pk=pk
        )
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, shared.group_id):
            return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if shared.uploaded_by_id == request.user.id:
            return Response(
                {"errors": [{"code": "shared_doc.self_reject", "message": "You cannot reject your own shared upload."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        if shared.status != ParticipantSharedDoc.STATUS_PENDING:
            return Response(
                {"errors": [{"code": "shared_doc.not_pending", "message": "Only PENDING uploads can be rejected."}], "data": None},
                status=status.HTTP_409_CONFLICT,
            )

        ser = RejectSharedDocSerializer(data=request.data)
        if not ser.is_valid():
            return _validation_error(ser.errors)

        from rest_framework.exceptions import ValidationError as DRFValidationError
        try:
            shared = reject_shared(
                shared=shared,
                reason=ser.validated_data["reason"],
                actor=request.user,
            )
        except DRFValidationError as exc:
            return _validation_error(exc.detail)

        return Response({"data": SharedDocSerializer(shared).data})


@extend_schema(exclude=True)
class AdminSharedUploadDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    # DELETE /admin/shared-uploads/:id
    def delete(self, request: Request, pk: str) -> Response:
        role = request.user.role
        if role not in ("ADMIN", "INSTRUCTOR", "GROUP_ADMIN"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Access denied."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        upload = get_object_or_404(ParticipantSharedDoc, pk=pk)
        if role == "INSTRUCTOR" and not instructor_owns_group(request.user, upload.group_id):
            return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if role == "GROUP_ADMIN" and not GroupAdmin.objects.filter(admin=request.user, group_id=upload.group_id).exists():
            return Response(
                {"errors": [{"code": "perm.not_group_admin", "message": "You are not the admin of this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        upload_id = upload.id
        upload.delete()
        log_action(
            actor=request.user,
            action="shared_doc.deleted",
            target_type="ParticipantSharedDoc",
            target_id=upload_id,
            metadata={"group_id": str(upload.group_id)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(exclude=True)
class SharedDocFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: str) -> Response:
        shared = get_object_or_404(ParticipantSharedDoc, pk=pk)
        # Permission: uploader, admin, or instructor of the group
        if request.user.role == "PARTICIPANT" and shared.uploaded_by_id != request.user.id:
            return Response(
                {"errors": [{"code": "perm.denied", "message": "Access denied."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, shared.group_id):
            return Response(_INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if not shared.file_data:
            return Response(
                {"errors": [{"code": "not_found", "message": "File not available."}], "data": None},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.http import HttpResponse
        import urllib.parse
        response = HttpResponse(bytes(shared.file_data), content_type=shared.file_type)
        safe_name = urllib.parse.quote(shared.file_name)
        response['Content-Disposition'] = f'attachment; filename="{shared.file_name}"; filename*=UTF-8\'\'{safe_name}'
        response['Content-Length'] = len(shared.file_data)
        return response
