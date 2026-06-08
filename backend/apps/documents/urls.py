from django.urls import path

from .views import (
    AdminSharedUploadApproveView,
    AdminSharedUploadListView,
    AdminSharedUploadRejectView,
    DocumentUploadUrlView,
    DocumentViewSet,
    GroupSharedUploadView,
    GroupUploadPermissionDetailView,
    GroupUploadPermissionView,
    MeSharedUploadsView,
    MeUploadPermissionsView,
    ParticipantSharedUploadUrlView,
)

doc_list = DocumentViewSet.as_view({"get": "list", "post": "create"})
doc_detail = DocumentViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
doc_download = DocumentViewSet.as_view({"get": "download"})

urlpatterns = [
    # Document CRUD + upload URL
    path("documents", doc_list),
    path("documents/upload-url", DocumentUploadUrlView.as_view()),
    path("documents/<uuid:pk>", doc_detail),
    path("documents/<uuid:pk>/download", doc_download),
    # Admin: upload permissions on a group
    path(
        "admin/groups/<uuid:group_id>/upload-permissions",
        GroupUploadPermissionView.as_view(),
    ),
    path(
        "admin/groups/<uuid:group_id>/upload-permissions/<uuid:user_id>",
        GroupUploadPermissionDetailView.as_view(),
    ),
    # Participant: see own permitted groups + own submissions
    path("me/upload-permissions", MeUploadPermissionsView.as_view()),
    path("me/shared-uploads", MeSharedUploadsView.as_view()),
    # Participant: get presigned URL + submit shared doc to a group
    path("groups/<uuid:group_id>/shared-upload-url", ParticipantSharedUploadUrlView.as_view()),
    path("groups/<uuid:group_id>/shared-uploads", GroupSharedUploadView.as_view()),
    # Admin: shared-upload queue + approve/reject
    path("admin/shared-uploads/pending", AdminSharedUploadListView.as_view()),
    path("admin/shared-uploads/<uuid:pk>/approve", AdminSharedUploadApproveView.as_view()),
    path("admin/shared-uploads/<uuid:pk>/reject", AdminSharedUploadRejectView.as_view()),
]
