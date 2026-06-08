from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounts.models import User


def instructor_can_view_all(user: User) -> bool:
    """Resolve whether a user may see classes beyond their assigned groups.

    Resolution order (BRD §7.3):
      1. Non-INSTRUCTOR admins  → always True (they see everything).
      2. Non-INSTRUCTOR others  → always False.
      3. INSTRUCTOR with explicit override → use that value.
      4. INSTRUCTOR with no override (None) → fall back to SystemSettings global default.
    """
    if user.role == "ADMIN":
        return True
    if user.role != "INSTRUCTOR":
        return False

    if user.can_view_all_classes is not None:
        return user.can_view_all_classes

    from apps.common.models import SystemSettings  # noqa: PLC0415

    return SystemSettings.get_solo().instructors_can_view_all_classes
