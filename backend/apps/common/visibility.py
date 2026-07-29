from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounts.models import User


def sub_mentor_can_view_all(user: User) -> bool:
    """Resolve whether a user may see classes beyond their assigned groups.

    Resolution order (BRD §7.3):
      1. Non-SUB_MENTOR admins  → always True (they see everything).
      2. Non-SUB_MENTOR others  → always False.
      3. SUB_MENTOR with explicit override → use that value.
      4. SUB_MENTOR with no override (None) → fall back to SystemSettings global default.
    """
    if user.role == "ADMIN":
        return True
    if user.role != "SUB_MENTOR":
        return False

    if user.can_view_all_classes is not None:
        return user.can_view_all_classes

    from apps.common.models import SystemSettings  # noqa: PLC0415

    return SystemSettings.get_solo().sub_mentors_can_view_all_classes
