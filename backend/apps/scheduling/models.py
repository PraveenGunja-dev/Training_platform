from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimestampedModel
from apps.groups.models import ClassGroup


class Class(TimestampedModel):
    STATUS_UPCOMING = "UPCOMING"
    STATUS_ONGOING = "ONGOING"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_UPCOMING, "Upcoming"),
        (STATUS_ONGOING, "Ongoing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    group = models.ForeignKey(
        ClassGroup,
        on_delete=models.CASCADE,
        related_name="classes",
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status_cached = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_UPCOMING,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_classes",
    )

    meeting_link = models.URLField(max_length=500, blank=True, default="")
    sub_group = models.ForeignKey(
        'groups.SubGroup',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='classes',
    )

    # Attendance window (absolute datetimes, relative to class start)
    attendance_open_at = models.DateTimeField(null=True, blank=True)
    attendance_close_at = models.DateTimeField(null=True, blank=True)
    allow_late_attendance = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["group", "starts_at"], name="cls_group_starts_idx"),
            models.Index(fields=["starts_at"], name="cls_starts_at_idx"),
        ]
        ordering = ["starts_at"]

    def __str__(self) -> str:
        return self.title

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.sub_group_id is not None and self.group_id is not None:
            # Import here to avoid circular imports
            from apps.groups.models import SubGroup
            try:
                sub = SubGroup.objects.get(pk=self.sub_group_id)
                if str(sub.parent_group_id) != str(self.group_id):
                    raise ValidationError(
                        {"sub_group": "Sub-group does not belong to the selected group."}
                    )
            except SubGroup.DoesNotExist:
                raise ValidationError({"sub_group": "Sub-group not found."})

    @property
    def computed_status(self) -> str:
        """Returns status_cached if admin has explicitly overridden it (CANCELLED/COMPLETED),
        otherwise derives live status from the scheduled time window."""
        if self.status_cached in (self.STATUS_CANCELLED, self.STATUS_COMPLETED):
            return self.status_cached
        now = timezone.now()
        if now < self.starts_at:
            return self.STATUS_UPCOMING
        if self.starts_at <= now <= self.ends_at:
            return self.STATUS_ONGOING
        return self.STATUS_COMPLETED

    def save(self, *args: object, **kwargs: object) -> None:
        # Preserve CANCELLED and COMPLETED if explicitly set by admin; otherwise derive from time.
        if self.status_cached not in (self.STATUS_CANCELLED, self.STATUS_COMPLETED):
            self.status_cached = self.computed_status
        super().save(*args, **kwargs)
