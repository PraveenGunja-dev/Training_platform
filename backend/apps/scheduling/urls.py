from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClassActivityView, ClassParticipantsView, ClassViewSet, ParticipantCalendarView, RecurringClassView

router = DefaultRouter(trailing_slash=False)
router.register("classes", ClassViewSet, basename="classes")

urlpatterns = [
    # Must come BEFORE router so "recurring" isn't swallowed by classes/<str:pk>
    path("classes/recurring", RecurringClassView.as_view(), name="class-recurring"),
] + router.urls + [
    path("me/calendar", ParticipantCalendarView.as_view(), name="me-calendar"),
    path("classes/<str:pk>/participants", ClassParticipantsView.as_view(), name="class-participants"),
    path("classes/<str:pk>/activity", ClassActivityView.as_view(), name="class-activity"),
]
