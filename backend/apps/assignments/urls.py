from django.conf import settings
from django.urls import path

from .views import (
    AssignmentTaskViewSet,
    ParticipantSubmissionsView,
    ParticipantTasksView,
    QuestionUploadUrlView,
    SubmissionDownloadView,
    SubmissionReviewView,
)

task_list = AssignmentTaskViewSet.as_view({"get": "list", "post": "create"})
task_detail = AssignmentTaskViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
task_upload_url = AssignmentTaskViewSet.as_view({"post": "upload_url"})
task_submissions = AssignmentTaskViewSet.as_view(
    {"get": "list_submissions", "post": "submit"}
)
task_close = AssignmentTaskViewSet.as_view({"post": "close"})
task_question_download = AssignmentTaskViewSet.as_view({"get": "question_download"})

urlpatterns = [
    path("assignments", task_list),
    path("assignments/question-upload-url", QuestionUploadUrlView.as_view()),
    path("assignments/<uuid:pk>/question-download", task_question_download),
    path("assignments/<uuid:pk>", task_detail),
    path("assignments/<uuid:pk>/upload-url", task_upload_url),
    path("assignments/<uuid:pk>/submissions", task_submissions),
    path("assignments/<uuid:pk>/close", task_close),
    path("me/tasks", ParticipantTasksView.as_view()),
    path("me/submissions", ParticipantSubmissionsView.as_view()),
    path("submissions/<uuid:pk>/download", SubmissionDownloadView.as_view()),
    path(
        "assignments/submissions/<uuid:submission_id>/review",
        SubmissionReviewView.as_view(),
        name="submission-review",
    ),
]

if settings.DEBUG:
    from .dev_views import DevDownloadView, DevUploadView

    urlpatterns += [
        path("dev/upload/<path:blob_name>", DevUploadView.as_view(), name="dev-upload"),
        path("dev/download/<path:blob_name>", DevDownloadView.as_view(), name="dev-download"),
    ]
