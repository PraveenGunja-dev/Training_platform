from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["type", "user", "status", "read_at", "created_at"]
    list_filter = ["type", "status", "channel"]
    search_fields = ["user__email", "title", "dedupe_key"]
