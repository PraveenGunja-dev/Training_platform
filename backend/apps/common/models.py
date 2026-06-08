import uuid

from django.db import models, transaction


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(UUIDModel):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SchedulerHealth(models.Model):
    """Single-row table; heartbeat task updates last_heartbeat_at every 60 s (wired in B-08)."""

    last_heartbeat_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "common_scheduler_health"

    def __str__(self) -> str:
        return f"SchedulerHealth(last={self.last_heartbeat_at})"


class SystemSettings(models.Model):
    """Singleton — always query with SystemSettings.get_solo(). Never call .create() directly."""

    product_name = models.CharField(max_length=100, default="Training Management System")
    timezone = models.CharField(max_length=64, default="UTC")
    brand_color = models.CharField(max_length=7, default="#4F46E5")
    doc_max_mb = models.PositiveIntegerField(default=25)
    image_max_mb = models.PositiveIntegerField(default=10)
    video_max_mb = models.PositiveIntegerField(default=500)
    reminder_offsets = models.JSONField(default=list)
    session_lifetime_hours = models.PositiveIntegerField(default=24)
    instructors_can_view_all_classes = models.BooleanField(default=False)
    attendance_drift_threshold_minutes = models.PositiveIntegerField(default=30)

    class Meta:
        db_table = "common_system_settings"
        verbose_name = "System Settings"

    @classmethod
    def get_solo(cls) -> "SystemSettings":
        with transaction.atomic():
            obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return "System Settings"
