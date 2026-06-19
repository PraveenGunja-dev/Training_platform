import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel


class ClassGroup(TimestampedModel):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_groups",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class GroupMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    group = models.ForeignKey(
        ClassGroup,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Creates btree index on (user_id, group_id) — covers user-alone queries
            models.UniqueConstraint(fields=["user", "group"], name="uniq_user_group"),
        ]
        indexes = [
            # Covers group-alone queries (e.g. list all members of a group)
            models.Index(fields=["group", "user"], name="groups_gm_group_user_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} → {self.group_id}"


class GroupInstructor(models.Model):
    group = models.ForeignKey(
        ClassGroup,
        on_delete=models.CASCADE,
        related_name="instructors",
    )
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="instructed_groups",
        limit_choices_to={"role": "INSTRUCTOR"},
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instructor_assignments_made",
    )

    class Meta:
        unique_together = ("group", "instructor")
        indexes = [
            models.Index(fields=["instructor", "group"], name="grp_ins_lookup_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.instructor_id} teaches {self.group_id}"


class SubGroup(TimestampedModel):
    """A named sub-batch within a ClassGroup. Members must belong to the parent group."""
    parent_group = models.ForeignKey(
        ClassGroup,
        on_delete=models.CASCADE,
        related_name='sub_groups',
    )
    name = models.CharField(max_length=200)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_sub_groups',
    )

    class Meta:
        unique_together = ('parent_group', 'name')
        ordering = ['name']

    def __str__(self) -> str:
        return f"{self.parent_group.name} / {self.name}"


class SubGroupMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sub_group = models.ForeignKey(
        SubGroup,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sub_group_memberships',
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sub_group', 'user')
        indexes = [
            models.Index(fields=['sub_group', 'user'], name='sgm_sub_user_idx'),
            models.Index(fields=['user'], name='sgm_user_idx'),  # covers user-alone queries
        ]

    def __str__(self) -> str:
        return f"{self.sub_group.name} — {self.user}"


class GroupAdmin(TimestampedModel):
    """One designated admin per ClassGroup, assigned by a Super Admin."""
    group = models.OneToOneField(
        ClassGroup,
        on_delete=models.CASCADE,
        related_name="group_admin",
    )
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_of_groups",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="group_admins_assigned",
    )

    class Meta:
        verbose_name = "Group Admin"
        verbose_name_plural = "Group Admins"

    def __str__(self):
        return f"{self.admin.full_name} → {self.group.name}"
