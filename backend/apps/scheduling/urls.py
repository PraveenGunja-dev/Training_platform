from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClassActivityView, ClassCountsView, ClassParticipantsView, ClassViewSet, MarkPastClassesCompletedView, ParticipantCalendarView, RecurringClassView

router = DefaultRouter(trailing_slash=False)
router.register("classes", ClassViewSet, basename="classes")

urlpatterns = [
    # Must come BEFORE router so these aren't swallowed by classes/<str:pk>
    path("classes/recurring", RecurringClassView.as_view(), name="class-recurring"),
    path("classes/counts", ClassCountsView.as_view(), name="class-counts"),
    path("admin/classes/mark-past-completed", MarkPastClassesCompletedView.as_view(), name="mark-past-completed"),
] + router.urls + [
    path("me/calendar", ParticipantCalendarView.as_view(), name="me-calendar"),
    path("classes/<str:pk>/participants", ClassParticipantsView.as_view(), name="class-participants"),
    path("classes/<str:pk>/activity", ClassActivityView.as_view(), name="class-activity"),
]
