from __future__ import annotations

"""
Queryset helpers that scope database rows to an Sub-Mentor's assigned groups.

Each function returns the correct model queryset filtered to groups where
the user appears in GroupSubMentor. Callers must branch on role == "SUB_MENTOR"
before calling; these helpers do not check role themselves.

sub_mentor_owns_group() is the boolean companion for write-gate checks.
"""


def sub_mentor_group_qs(user):
    """ClassGroups assigned to *user* via GroupSubMentor."""
    from apps.groups.models import ClassGroup, GroupSubMentor  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return ClassGroup.objects.filter(pk__in=assigned_ids)


def sub_mentor_class_qs(user):
    """Classes whose group is assigned to *user*."""
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415
    from apps.scheduling.models import Class  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return Class.objects.filter(group_id__in=assigned_ids)


def sub_mentor_session_qs(user):
    """AttendanceSessions for classes in *user*'s assigned groups."""
    from apps.attendance.models import AttendanceSession  # noqa: PLC0415
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return AttendanceSession.objects.filter(class_obj__group_id__in=assigned_ids)


def sub_mentor_assignment_qs(user):
    """AssignmentTasks in *user*'s assigned groups."""
    from apps.assignments.models import AssignmentTask  # noqa: PLC0415
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return AssignmentTask.objects.filter(group_id__in=assigned_ids)


def sub_mentor_submission_qs(user):
    """Submissions for tasks in *user*'s assigned groups."""
    from apps.assignments.models import Submission  # noqa: PLC0415
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return Submission.objects.filter(task__group_id__in=assigned_ids)


def sub_mentor_document_qs(user):
    """Documents belonging to *user*'s assigned groups."""
    from apps.documents.models import Document  # noqa: PLC0415
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return Document.objects.filter(group_id__in=assigned_ids)


def sub_mentor_shared_upload_qs(user):
    """ParticipantSharedDocs belonging to *user*'s assigned groups."""
    from apps.documents.models import ParticipantSharedDoc  # noqa: PLC0415
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415

    assigned_ids = GroupSubMentor.objects.filter(sub_mentor=user).values_list("group_id", flat=True)
    return ParticipantSharedDoc.objects.filter(group_id__in=assigned_ids)


def sub_mentor_owns_group(user, group_id) -> bool:
    """Return True if *user* (SUB_MENTOR) is assigned to *group_id*."""
    from apps.groups.models import GroupSubMentor  # noqa: PLC0415

    return GroupSubMentor.objects.filter(sub_mentor=user, group_id=group_id).exists()


# ---------------------------------------------------------------------------
# Lead Mentor scoping helpers (mirror of sub_mentor_* helpers above)
# ---------------------------------------------------------------------------


def lead_mentor_group_qs(user):
    """ClassGroups where *user* is the Lead Mentor via GroupLeadMentor."""
    from apps.groups.models import ClassGroup, GroupLeadMentor  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return ClassGroup.objects.filter(pk__in=assigned_ids)


def lead_mentor_class_qs(user):
    """Classes whose group has *user* as Lead Mentor."""
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415
    from apps.scheduling.models import Class  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return Class.objects.filter(group_id__in=assigned_ids)


def lead_mentor_session_qs(user):
    """AttendanceSessions for classes in *user*'s lead-mentor groups."""
    from apps.attendance.models import AttendanceSession  # noqa: PLC0415
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return AttendanceSession.objects.filter(class_obj__group_id__in=assigned_ids)


def lead_mentor_assignment_qs(user):
    """AssignmentTasks in *user*'s lead-mentor groups."""
    from apps.assignments.models import AssignmentTask  # noqa: PLC0415
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return AssignmentTask.objects.filter(group_id__in=assigned_ids)


def lead_mentor_submission_qs(user):
    """Submissions for tasks in *user*'s lead-mentor groups."""
    from apps.assignments.models import Submission  # noqa: PLC0415
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return Submission.objects.filter(task__group_id__in=assigned_ids)


def lead_mentor_document_qs(user):
    """Documents belonging to *user*'s lead-mentor groups."""
    from apps.documents.models import Document  # noqa: PLC0415
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return Document.objects.filter(group_id__in=assigned_ids)


def lead_mentor_shared_upload_qs(user):
    """ParticipantSharedDocs belonging to *user*'s lead-mentor groups."""
    from apps.documents.models import ParticipantSharedDoc  # noqa: PLC0415
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415

    assigned_ids = GroupLeadMentor.objects.filter(lead_mentor=user).values_list("group_id", flat=True)
    return ParticipantSharedDoc.objects.filter(group_id__in=assigned_ids)


def lead_mentor_owns_group(user, group_id) -> bool:
    """Return True if *user* (LEAD_MENTOR) is the Lead Mentor of *group_id*."""
    from apps.groups.models import GroupLeadMentor  # noqa: PLC0415

    return GroupLeadMentor.objects.filter(lead_mentor=user, group_id=group_id).exists()
