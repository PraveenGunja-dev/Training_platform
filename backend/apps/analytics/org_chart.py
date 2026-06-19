from __future__ import annotations

import re

from apps.accounts.models import User
from apps.groups.models import ClassGroup, GroupAdmin, GroupInstructor, GroupMembership, SubGroup


def _user_dict(user: User) -> dict:
    return {"id": str(user.id), "name": user.full_name, "email": user.email}


def _natural_key(s: str) -> list:
    """Split string into text/number segments so 'Batch 2' < 'Batch 10'."""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r"(\d+)", s)]


def get_org_chart_data() -> dict:
    """Return the full org-chart hierarchy for the admin org-chart page."""

    # Admins
    admins = list(
        User.objects.filter(role="ADMIN", is_active=True).only("id", "full_name", "email")
    )

    # All non-archived groups with instructors, memberships, and sub-groups prefetched
    groups_qs = (
        ClassGroup.objects.filter(is_archived=False)
        .prefetch_related(
            "instructors__instructor",       # GroupInstructor → instructor User
            "memberships__user",             # GroupMembership  → user User
            "sub_groups__memberships__user", # SubGroup → SubGroupMembership → User
            "group_admin__admin",            # GroupAdmin → admin User
        )
    )

    groups_data = []
    assigned_instructor_ids: set = set()

    for group in groups_qs:
        group_instructors = []
        for gi in group.instructors.all():
            group_instructors.append(_user_dict(gi.instructor))
            assigned_instructor_ids.add(gi.instructor_id)

        memberships_list = list(group.memberships.all())
        if len(memberships_list) > 200:
            group_participants = []  # too large — caller uses participants_count instead
        else:
            group_participants = [_user_dict(gm.user) for gm in memberships_list]

        sub_groups = [
            {
                "id": str(sg.id),
                "name": sg.name,
                "participants": [_user_dict(m.user) for m in sg.memberships.all()],
                "participants_count": sg.memberships.count(),
            }
            for sg in group.sub_groups.all()
        ]

        try:
            ga = group.group_admin
            group_admin_data = _user_dict(ga.admin)
        except GroupAdmin.DoesNotExist:
            group_admin_data = None

        groups_data.append(
            {
                "id": str(group.id),
                "name": group.name,
                "is_archived": group.is_archived,
                "instructors": group_instructors,
                "participants": group_participants,
                "participants_count": len(memberships_list),
                "sub_groups": sub_groups,
                "group_admin": group_admin_data,
            }
        )

    groups_data.sort(key=lambda g: _natural_key(g["name"]))

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
            "total_group_admins": GroupAdmin.objects.count(),
            "total_sub_groups": SubGroup.objects.count(),
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
