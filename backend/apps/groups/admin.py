from django.contrib import admin

from .models import ClassGroup, GroupMembership, SubGroup, SubGroupMembership


@admin.register(ClassGroup)
class ClassGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "is_archived", "created_by", "created_at"]
    list_filter = ["is_archived"]
    search_fields = ["name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ["group", "user", "joined_at"]
    list_filter = ["group"]
    readonly_fields = ["joined_at"]


@admin.register(SubGroup)
class SubGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "parent_group", "created_by", "created_at"]
    list_filter = ["parent_group"]
    search_fields = ["name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(SubGroupMembership)
class SubGroupMembershipAdmin(admin.ModelAdmin):
    list_display = ["sub_group", "user", "joined_at"]
    list_filter = ["sub_group__parent_group", "sub_group"]
    readonly_fields = ["joined_at"]
