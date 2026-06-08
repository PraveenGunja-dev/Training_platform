from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClassParticipantsView, ClassViewSet, ParticipantCalendarView, ShareQRView

router = DefaultRouter(trailing_slash=False)
router.register("classes", ClassViewSet, basename="classes")

urlpatterns = router.urls + [
    path("me/calendar", ParticipantCalendarView.as_view(), name="me-calendar"),
    path("classes/<str:pk>/participants", ClassParticipantsView.as_view(), name="class-participants"),
    path("classes/<str:pk>/share-qr", ShareQRView.as_view(), name="class-share-qr"),
]
