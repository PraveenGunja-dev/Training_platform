from django.contrib import admin

from .models import Document, ParticipantSharedDoc, ParticipantUploadPermission


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "group", "doc_type", "visibility", "uploaded_by", "created_at"]
    list_filter = ["doc_type", "visibility"]
    search_fields = ["title", "file_name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(ParticipantUploadPermission)
class ParticipantUploadPermissionAdmin(admin.ModelAdmin):
    list_display = ["user", "group", "granted_by", "created_at"]
    search_fields = ["user__email", "group__name"]
    readonly_fields = ["created_at"]


@admin.register(ParticipantSharedDoc)
class ParticipantSharedDocAdmin(admin.ModelAdmin):
    list_display = ["title", "group", "uploaded_by", "status", "reviewed_by", "created_at"]
    list_filter = ["status"]
    search_fields = ["title", "uploaded_by__email"]
    readonly_fields = ["created_at", "reviewed_at"]
