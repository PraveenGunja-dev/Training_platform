from django.urls import path

from .views import InstructorListView, UserViewSet, UserVisibilityView

# Explicit URL patterns to avoid DRF router collision: both GET (list) and
# POST (invite) need to live at /users — the router would create two separate
# patterns for the same URL, and Django only dispatches to the first match.
users_list = UserViewSet.as_view({"get": "list", "post": "invite"})
users_bulk = UserViewSet.as_view({"post": "bulk_invite"})
users_stats = UserViewSet.as_view({"get": "stats"})
users_business_units = UserViewSet.as_view({"get": "business_units"})
users_detail = UserViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
users_resend = UserViewSet.as_view({"post": "resend_invite"})

urlpatterns = [
    # specific paths BEFORE parameterised ones
    path("instructors", InstructorListView.as_view(), name="instructors-list"),
    path("users/bulk-invite", users_bulk, name="users-bulk-invite"),
    path("users/stats", users_stats, name="users-stats"),
    path("users/business-units", users_business_units, name="users-business-units"),
    path("users", users_list, name="users-list"),
    path("users/<uuid:pk>", users_detail, name="users-detail"),
    path("users/<uuid:pk>/resend-invite", users_resend, name="users-resend-invite"),
    path("users/<uuid:pk>/visibility", UserVisibilityView.as_view(), name="users-visibility"),
]
