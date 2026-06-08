from django.contrib import admin

from .models import AssignmentTask, Submission, SubmissionReview


@admin.register(AssignmentTask)
class AssignmentTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "group", "late_policy", "is_open", "is_closed", "deadline_at")
    list_filter = ("late_policy", "is_open", "is_closed")
    search_fields = ("title",)
    raw_id_fields = ("group", "class_obj", "created_by")


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("task", "user", "version", "status", "submitted_at")
    list_filter = ("status",)
    search_fields = ("task__title", "user__email")
    raw_id_fields = ("task", "user", "submitted_by")


@admin.register(SubmissionReview)
class SubmissionReviewAdmin(admin.ModelAdmin):
    list_display = ["submission", "reviewer", "grade_numeric", "grade_letter", "reviewed_at"]
    readonly_fields = ["reviewed_at", "updated_at"]
