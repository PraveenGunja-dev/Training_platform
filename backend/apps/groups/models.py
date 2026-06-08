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
            models.UniqueConstraint(fields=["user", "group"], name="uniq_user_group"),
        ]
        indexes = [
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
