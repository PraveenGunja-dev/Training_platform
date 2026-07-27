from django.urls import path
from .views import AdminDashboardView, LeadMentorDashboardView, ParticipantDashboardView

urlpatterns = [
    path("admin", AdminDashboardView.as_view(), name="dashboard-admin"),
    path("participant", ParticipantDashboardView.as_view(), name="dashboard-participant"),
    path("lead-mentor", LeadMentorDashboardView.as_view(), name="dashboard-lead-mentor"),
]
