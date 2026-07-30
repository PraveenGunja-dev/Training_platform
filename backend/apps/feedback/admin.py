from django.contrib import admin

from .models import ClassFeedback


@admin.register(ClassFeedback)
class ClassFeedbackAdmin(admin.ModelAdmin):
    list_display = ["id", "class_session", "participant", "rating", "submitted_at"]
    list_filter = ["rating"]
    raw_id_fields = ["class_session", "participant"]
    readonly_fields = ["id", "submitted_at"]
