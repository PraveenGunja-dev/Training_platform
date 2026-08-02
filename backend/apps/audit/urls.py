from django.urls import path

from .views import AuditLogExportView, AuditLogListView

urlpatterns = [
    path("audit", AuditLogListView.as_view(), name="audit-list"),
    path("audit/export", AuditLogExportView.as_view(), name="audit-export"),
]
