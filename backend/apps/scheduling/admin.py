from django.contrib import admin

from .models import Class


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ["title", "group", "sub_group", "starts_at", "ends_at", "status_cached", "created_by"]
    list_filter = ["status_cached", "group"]
    search_fields = ["title"]
    raw_id_fields = ["group", "created_by"]
    ordering = ["starts_at"]
