from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Append-only audit trail for all important system actions."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_log"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["actor", "created_at"], name="audit_log_actor_created_idx"),
            models.Index(fields=["target_type", "target_id"], name="audit_log_target_idx"),
            models.Index(fields=["action", "created_at"], name="audit_log_action_created_idx"),
        ]

    def __str__(self) -> str:
        return f"AuditLog({self.action}, actor={self.actor_id}, target={self.target_type}:{self.target_id})"

    def save(self, *args, **kwargs) -> None:
        if self.pk:
            raise PermissionError("AuditLog entries are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # type: ignore[override]
        raise PermissionError("AuditLog entries cannot be deleted.")
