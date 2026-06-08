from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import NotificationPreferenceView, NotificationViewSet

router = SimpleRouter(trailing_slash=False)
router.register("notifications", NotificationViewSet, basename="notifications")
urlpatterns = router.urls + [
    path(
        "me/notification-preferences",
        NotificationPreferenceView.as_view(),
        name="me-notification-preferences",
    ),
]
