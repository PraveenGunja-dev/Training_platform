from __future__ import annotations

from apps.accounts.models import User
from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership


def _user_dict(user: User) -> dict:
    return {"id": str(user.id), "name": user.full_name, "email": user.email}


def get_org_chart_data() -> dict:
    """Return the full org-chart hierarchy for the admin org-chart page."""

    # Admins
    admins = list(
        User.objects.filter(role="ADMIN", is_active=True).only("id", "full_name", "email")
    )

    # All non-archived groups with instructors and memberships prefetched
    groups_qs = (
        ClassGroup.objects.filter(is_archived=False)
        .prefetch_related(
            "instructors__instructor",  # GroupInstructor → instructor User
            "memberships__user",        # GroupMembership  → user User
        )
        .order_by("name")
    )

    groups_data = []
    assigned_instructor_ids: set = set()

    for group in groups_qs:
        group_instructors = []
        for gi in group.instructors.all():
            group_instructors.append(_user_dict(gi.instructor))
            assigned_instructor_ids.add(gi.instructor_id)

        group_participants = [_user_dict(gm.user) for gm in group.memberships.all()]

        groups_data.append(
            {
                "id": str(group.id),
                "name": group.name,
                "is_archived": group.is_archived,
                "instructors": group_instructors,
                "participants": group_participants,
            }
        )

    # Unassigned instructors: active instructors not in any GroupInstructor row
    all_instructors = User.objects.filter(role="INSTRUCTOR", is_active=True).only(
        "id", "full_name", "email"
    )
    unassigned_instructors = [
        _user_dict(u) for u in all_instructors if u.id not in assigned_instructor_ids
    ]

    return {
        "stats": {
            "total_admins": len(admins),
            "total_groups": len(groups_data),
            "total_instructors": User.objects.filter(
                role="INSTRUCTOR", is_active=True
            ).count(),
            "total_participants": User.objects.filter(
                role="PARTICIPANT", is_active=True
            ).count(),
        },
        "admins": [_user_dict(u) for u in admins],
        "groups": groups_data,
        "unassigned_instructors": unassigned_instructors,
    }
