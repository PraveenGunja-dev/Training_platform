from __future__ import annotations

import re

from apps.accounts.models import User
from apps.groups.models import ClassGroup, GroupLeadMentor, GroupSubMentor, GroupMembership, SubGroup


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

    # All non-archived groups with Sub-Mentors, memberships, and sub-groups prefetched
    groups_qs = (
        ClassGroup.objects.filter(is_archived=False)
        .prefetch_related(
            "sub_mentors__sub_mentor",       # GroupSubMentor → Sub-Mentor User
            "memberships__user",             # GroupMembership  → user User
            "sub_groups__memberships__user", # SubGroup → SubGroupMembership → User
            "lead_mentor_assignment__lead_mentor",            # GroupLeadMentor → admin User
        )
    )

    groups_data = []
    assigned_sub_mentor_ids: set = set()

    for group in groups_qs:
        group_sub_mentors = []
        for gi in group.sub_mentors.all():
            group_sub_mentors.append(_user_dict(gi.sub_mentor))
            assigned_sub_mentor_ids.add(gi.sub_mentor_id)

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
            ga = group.lead_mentor_assignment
            lead_mentor_data = _user_dict(ga.lead_mentor)
        except GroupLeadMentor.DoesNotExist:
            lead_mentor_data = None

        groups_data.append(
            {
                "id": str(group.id),
                "name": group.name,
                "is_archived": group.is_archived,
                "sub_mentors": group_sub_mentors,
                "participants": group_participants,
                "participants_count": len(memberships_list),
                "sub_groups": sub_groups,
                "lead_mentor": lead_mentor_data,
            }
        )

    groups_data.sort(key=lambda g: _natural_key(g["name"]))

    # Unassigned Sub-Mentors: active Sub-Mentors not in any GroupSubMentor row
    all_sub_mentors = User.objects.filter(role="SUB_MENTOR", is_active=True).only(
        "id", "full_name", "email"
    )
    unassigned_sub_mentors = [
        _user_dict(u) for u in all_sub_mentors if u.id not in assigned_sub_mentor_ids
    ]

    return {
        "stats": {
            "total_admins": len(admins),
            "total_groups": len(groups_data),
            "total_lead_mentors": GroupLeadMentor.objects.count(),
            "total_sub_groups": SubGroup.objects.count(),
            "total_sub_mentors": User.objects.filter(
                role="SUB_MENTOR", is_active=True
            ).count(),
            "total_participants": User.objects.filter(
                role="PARTICIPANT", is_active=True
            ).count(),
        },
        "admins": [_user_dict(u) for u in admins],
        "groups": groups_data,
        "unassigned_sub_mentors": unassigned_sub_mentors,
    }
