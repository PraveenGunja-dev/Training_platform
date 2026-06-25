from django.urls import path

from .views import (
    AssignmentTaskViewSet,
    ParticipantSubmissionsView,
    ParticipantTasksView,
    SubmissionFileView,
    SubmissionReviewView,
)

task_list = AssignmentTaskViewSet.as_view({"get": "list", "post": "create"})
task_detail = AssignmentTaskViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
task_submissions = AssignmentTaskViewSet.as_view(
    {"get": "list_submissions", "post": "submit"}
)
task_close = AssignmentTaskViewSet.as_view({"post": "close"})
task_question_file = AssignmentTaskViewSet.as_view(
    {"get": "question_file_download", "post": "question_file_upload"}
)

urlpatterns = [
    path("assignments", task_list),
    path("assignments/<uuid:pk>/question-file", task_question_file),
    path("assignments/<uuid:pk>", task_detail),
    path("assignments/<uuid:pk>/submissions", task_submissions),
    path("assignments/<uuid:pk>/close", task_close),
    path("me/tasks", ParticipantTasksView.as_view()),
    path("me/submissions", ParticipantSubmissionsView.as_view()),
    path("submissions/<uuid:pk>/file", SubmissionFileView.as_view()),
    path(
        "assignments/submissions/<uuid:submission_id>/review",
        SubmissionReviewView.as_view(),
        name="submission-review",
    ),
]
