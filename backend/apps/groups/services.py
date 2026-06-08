import uuid as _uuid
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model

from apps.audit.services import log_action
from apps.notifications.services import create_inapp

from .models import ClassGroup, GroupMembership

User = get_user_model()


def add_participants(
    group: ClassGroup,
    user_ids: list[UUID],
    actor: Any,
) -> dict:
    """Bulk-add participants. Skips existing members and non-existent users."""
    uid_strs = [str(uid) for uid in user_ids]

    valid_ids = set(
        str(uid)
        for uid in User.objects.filter(id__in=uid_strs).values_list("id", flat=True)
    )
    already_in = set(
        str(uid)
        for uid in GroupMembership.objects.filter(
            group=group, user_id__in=valid_ids
        ).values_list("user_id", flat=True)
    )

    added: list[str] = []
    skipped: list[str] = []
    seen: set[str] = set()
    to_create: list[GroupMembership] = []

    for uid_str in uid_strs:
        if uid_str in seen:
            skipped.append(uid_str)
            continue
        seen.add(uid_str)

        if uid_str not in valid_ids or uid_str in already_in:
            skipped.append(uid_str)
        else:
            to_create.append(GroupMembership(group=group, user_id=uid_str))
            added.append(uid_str)

    if to_create:
        GroupMembership.objects.bulk_create(to_create)

    if added:
        for user in User.objects.filter(id__in=added):
            create_inapp(
                user=user,
                type="GROUP_ADDED",
                title="Added to group",
                body=f"You have been added to {group.name}.",
                link="/me/dashboard",
                dedupe_key=f"group_added:{group.id}:{user.id}",
                payload={"group_id": str(group.id), "group_name": group.name},
            )
        # Notify instructors that new participants joined
        from apps.notifications.services import notify_instructors  # noqa: PLC0415
        count = len(added)
        notify_instructors(
            group=group,
            notification_type="PARTICIPANTS_ADDED_TO_GROUP",
            title=f"New participants in {group.name}",
            body=f"{count} new participant(s) joined {group.name}.",
            link=f"/instructor/groups/{group.id}",
            payload={"group_id": str(group.id), "added_count": count},
            actor=actor,
            dedupe_suffix=f"add:{_uuid.uuid4()}",
        )

    log_action(
        actor=actor,
        action="group.participants_added",
        target_type="ClassGroup",
        target_id=group.id,
        metadata={"added": added, "skipped": skipped},
    )
    return {"added": added, "skipped": skipped}


def remove_participant(
    group: ClassGroup,
    user_id: str | UUID,
    actor: Any,
) -> None:
    """Remove a single participant from a group."""
    GroupMembership.objects.filter(group=group, user_id=str(user_id)).delete()
    log_action(
        actor=actor,
        action="group.participant_removed",
        target_type="ClassGroup",
        target_id=group.id,
        metadata={"user_id": str(user_id)},
    )
    from apps.notifications.services import notify_instructors  # noqa: PLC0415
    notify_instructors(
        group=group,
        notification_type="PARTICIPANTS_REMOVED_FROM_GROUP",
        title=f"Participant removed from {group.name}",
        body=f"A participant has been removed from {group.name}.",
        link=f"/instructor/groups/{group.id}",
        payload={"group_id": str(group.id), "user_id": str(user_id)},
        actor=actor,
        dedupe_suffix=f"rem:{_uuid.uuid4()}",
    )
