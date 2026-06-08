from django.urls import path

from .settings_views import AdminSettingsView, ForceLogoutView
from .views import HealthzView

urlpatterns = [
    path("healthz", HealthzView.as_view(), name="healthz"),
    path("admin/settings", AdminSettingsView.as_view(), name="admin-settings"),
    path("admin/settings/force-logout", ForceLogoutView.as_view(), name="admin-force-logout"),
]
