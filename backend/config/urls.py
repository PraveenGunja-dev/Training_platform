from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.analytics.views import OrgChartView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    # GET/PATCH /api/v1/me + POST /api/v1/me/password
    path("api/v1/", include("apps.accounts.me_urls")),
    # Common
    path("api/v1/", include("apps.common.urls")),
    # Audit
    path("api/v1/", include("apps.audit.urls")),
    # Groups
    path("api/v1/", include("apps.groups.urls")),
    # Scheduling (classes + /me/calendar)
    path("api/v1/", include("apps.scheduling.urls")),
    # Attendance (sessions + records)
    path("api/v1/", include("apps.attendance.urls")),
    # Assignments + Submissions + Blob SAS
    path("api/v1/", include("apps.assignments.urls")),
    # Documents + Shared-upload approval
    path("api/v1/", include("apps.documents.urls")),
    # Notifications (in-app)
    path("api/v1/", include("apps.notifications.urls")),
    # Dashboard (admin + participant analytics)
    path("api/v1/dashboard/", include("apps.analytics.urls")),
    # Org-chart
    path("api/v1/admin/org-chart", OrgChartView.as_view(), name="org-chart"),
    # User management (Admin-only — invite, CRUD, bulk-invite, resend)
    path("api/v1/", include("apps.users.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
