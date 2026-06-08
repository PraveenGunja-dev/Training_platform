from typing import Any

from .models import AuditLog


def log_action(
    actor: Any,
    action: str,
    target_type: str,
    target_id: Any,
    metadata: dict | None = None,
) -> AuditLog:
    """Central helper used by every app to write an audit entry."""
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        metadata=metadata or {},
    )
