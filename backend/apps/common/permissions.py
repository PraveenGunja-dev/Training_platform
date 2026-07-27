from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with role == 'ADMIN'."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "ADMIN"
        )


class IsSubMentor(BasePermission):
    """Allow access only to users with role == 'SUB_MENTOR'."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "SUB_MENTOR"
        )


class IsAdminOrSubMentor(BasePermission):
    """Allow access to ADMIN or SUB_MENTOR users. Scoping is enforced in the viewset."""

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("ADMIN", "SUB_MENTOR")
        )


class IsSubMentorOfGroup(BasePermission):
    """Object-level: allow if the Sub-Mentor is assigned to the object's group.

    The object must expose a `group` or `group_id` attribute.
    Uses a function-local import of GroupSubMentor to avoid circular imports.
    """

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "SUB_MENTOR"
        )

    def has_object_permission(self, request, view, obj) -> bool:
        from apps.groups.models import GroupSubMentor  # noqa: PLC0415

        group_id = getattr(obj, "group_id", None) or getattr(obj, "id", None)
        if group_id is None:
            return False
        return GroupSubMentor.objects.filter(
            sub_mentor=request.user, group_id=group_id
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
