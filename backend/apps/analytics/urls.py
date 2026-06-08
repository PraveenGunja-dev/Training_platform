from django.urls import path
from .views import AdminDashboardView, ParticipantDashboardView

urlpatterns = [
    path("admin", AdminDashboardView.as_view(), name="dashboard-admin"),
    path("participant", ParticipantDashboardView.as_view(), name="dashboard-participant"),
]
