from django.urls import path

from .views import (
    ActiveSessionView,
    AdminRecordOverrideView,
    AdminSessionViewSet,
    MarkAttendanceView,
)

_sessions = AdminSessionViewSet.as_view
urlpatterns = [
    # Admin endpoints
    path(
        "admin/attendance/sessions",
        _sessions({"get": "list", "post": "create"}),
        name="admin-attendance-sessions-list",
    ),
    path(
        "admin/attendance/sessions/<uuid:pk>",
        _sessions({"get": "retrieve"}),
        name="admin-attendance-sessions-detail",
    ),
    path(
        "admin/attendance/sessions/<uuid:pk>/end",
        _sessions({"post": "end"}),
        name="admin-attendance-sessions-end",
    ),
    path(
        "admin/attendance/sessions/<uuid:pk>/report",
        _sessions({"get": "report"}),
        name="admin-attendance-sessions-report",
    ),
    path(
        "admin/attendance/records/<uuid:pk>",
        AdminRecordOverrideView.as_view(),
        name="admin-attendance-records-override",
    ),
    # Participant endpoints
    path(
        "attendance/active-session",
        ActiveSessionView.as_view(),
        name="attendance-active-session",
    ),
    path(
        "attendance/sessions/<uuid:pk>/mark",
        MarkAttendanceView.as_view(),
        name="attendance-mark",
    ),
]
