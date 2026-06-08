from django.urls import path

from .views import ChangeEmailView, ChangePasswordView, MePhotoView, MeView

urlpatterns = [
    path("me", MeView.as_view(), name="me"),
    path("me/password", ChangePasswordView.as_view(), name="me-password"),
    path("me/email", ChangeEmailView.as_view(), name="me-email"),
    path("me/photo", MePhotoView.as_view(), name="me-photo"),
]
