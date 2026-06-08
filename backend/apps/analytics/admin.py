from django.contrib import admin
from .models import DashboardSnapshot


@admin.register(DashboardSnapshot)
class DashboardSnapshotAdmin(admin.ModelAdmin):
    list_display = ["date", "created_at"]
