from django.urls import path

from .views import (
    AdminSharedUploadApproveView,
    AdminSharedUploadDeleteView,
    AdminSharedUploadListView,
    AdminSharedUploadRejectView,
    DocumentViewSet,
    GroupSharedUploadView,
    GroupUploadPermissionDetailView,
    GroupUploadPermissionView,
    MeSharedUploadsView,
    MeUploadPermissionsView,
    SharedDocFileView,
)

doc_list = DocumentViewSet.as_view({"get": "list", "post": "create"})
doc_detail = DocumentViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
doc_file = DocumentViewSet.as_view({"get": "file"})

urlpatterns = [
    # Document CRUD + file endpoint
    path("documents", doc_list),
    path("documents/<uuid:pk>", doc_detail),
    path("documents/<uuid:pk>/file", doc_file),
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
    # Participant: submit shared doc to a group
    path("groups/<uuid:group_id>/shared-uploads", GroupSharedUploadView.as_view()),
    # Shared doc file download
    path("shared-uploads/<uuid:pk>/file", SharedDocFileView.as_view()),
    # Admin: shared-upload queue + approve/reject/delete
    path("admin/shared-uploads/pending", AdminSharedUploadListView.as_view()),
    path("admin/shared-uploads/<uuid:pk>/approve", AdminSharedUploadApproveView.as_view()),
    path("admin/shared-uploads/<uuid:pk>/reject", AdminSharedUploadRejectView.as_view()),
    path("admin/shared-uploads/<uuid:pk>", AdminSharedUploadDeleteView.as_view()),
]
