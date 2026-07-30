from django.urls import path

from .views import (
    FeedbackAdminView,
    FeedbackAnalyticsView,
    FeedbackListView,
    MyFeedbackView,
    SubmitFeedbackView,
)

urlpatterns = [
    path("feedback/submit", SubmitFeedbackView.as_view(), name="feedback-submit"),
    path("feedback/my", MyFeedbackView.as_view(), name="feedback-my"),
    path("feedback/list", FeedbackListView.as_view(), name="feedback-list"),
    path("feedback/admin", FeedbackAdminView.as_view(), name="feedback-admin"),
    path("feedback/analytics", FeedbackAnalyticsView.as_view(), name="feedback-analytics"),
]
