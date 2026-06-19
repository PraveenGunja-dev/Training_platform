from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClassGroupViewSet, MeGroupsView, SubGroupViewSet

router = DefaultRouter(trailing_slash=False)
router.register("groups", ClassGroupViewSet, basename="groups")

urlpatterns = router.urls + [
    path("me/groups", MeGroupsView.as_view(), name="me-groups"),

    # Sub-groups — manual nested routes (no djangorestframework-nested)
    path(
        "groups/<str:group_pk>/sub-groups",
        SubGroupViewSet.as_view({"get": "list", "post": "create"}),
        name="subgroup-list",
    ),
    path(
        "groups/<str:group_pk>/sub-groups/<str:pk>",
        SubGroupViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="subgroup-detail",
    ),
]
