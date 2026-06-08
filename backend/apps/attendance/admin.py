from django.contrib import admin

from .models import AttendanceRecord, AttendanceSession


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "class_obj", "status", "started_at", "started_by", "ended_at"]
    list_filter = ["status"]
    raw_id_fields = ["class_obj", "started_by", "ended_by"]


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ["id", "session", "user", "status", "marked_at"]
    list_filter = ["status"]
    raw_id_fields = ["session", "user"]
