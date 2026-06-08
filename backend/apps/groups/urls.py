from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClassGroupViewSet, MeGroupsView

router = DefaultRouter(trailing_slash=False)
router.register("groups", ClassGroupViewSet, basename="groups")

urlpatterns = router.urls + [
    path("me/groups", MeGroupsView.as_view(), name="me-groups"),
]
