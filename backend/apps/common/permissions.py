from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with role == 'ADMIN'."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "ADMIN"
        )


class IsInstructor(BasePermission):
    """Allow access only to users with role == 'INSTRUCTOR'."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "INSTRUCTOR"
        )


class IsAdminOrInstructor(BasePermission):
    """Allow access to ADMIN or INSTRUCTOR users. Scoping is enforced in the viewset."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("ADMIN", "INSTRUCTOR")
        )


class IsInstructorOfGroup(BasePermission):
    """Object-level: allow if the instructor is assigned to the object's group.

    The object must expose a `group` or `group_id` attribute.
    Uses a function-local import of GroupInstructor to avoid circular imports.
    """

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "INSTRUCTOR"
        )

    def has_object_permission(self, request, view, obj) -> bool:
        from apps.groups.models import GroupInstructor  # noqa: PLC0415

        group_id = getattr(obj, "group_id", None) or getattr(obj, "id", None)
        if group_id is None:
            return False
        return GroupInstructor.objects.filter(
            instructor=request.user, group_id=group_id
        ).exists()


class IsParticipantInGroup(BasePermission):
    """Object-level: allow if the authenticated user is a member of the object's group.

    Uses a function-local import of GroupMembership to avoid circular imports between
    common and groups apps.
    """

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        from apps.groups.models import GroupMembership  # noqa: PLC0415

        group_id = getattr(obj, "group_id", None) or getattr(obj, "id", None)
        if group_id is None:
            return False
        return GroupMembership.objects.filter(
            user=request.user, group_id=group_id
        ).exists()
