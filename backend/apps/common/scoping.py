from __future__ import annotations

"""
Queryset helpers that scope database rows to an instructor's assigned groups.

Each function returns the correct model queryset filtered to groups where
the user appears in GroupInstructor. Callers must branch on role == "INSTRUCTOR"
before calling; these helpers do not check role themselves.

instructor_owns_group() is the boolean companion for write-gate checks.
"""


def instructor_group_qs(user):
    """ClassGroups assigned to *user* via GroupInstructor."""
    from apps.groups.models import ClassGroup, GroupInstructor  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return ClassGroup.objects.filter(pk__in=assigned_ids)


def instructor_class_qs(user):
    """Classes whose group is assigned to *user*."""
    from apps.groups.models import GroupInstructor  # noqa: PLC0415
    from apps.scheduling.models import Class  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return Class.objects.filter(group_id__in=assigned_ids)


def instructor_session_qs(user):
    """AttendanceSessions for classes in *user*'s assigned groups."""
    from apps.attendance.models import AttendanceSession  # noqa: PLC0415
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return AttendanceSession.objects.filter(class_obj__group_id__in=assigned_ids)


def instructor_assignment_qs(user):
    """AssignmentTasks in *user*'s assigned groups."""
    from apps.assignments.models import AssignmentTask  # noqa: PLC0415
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return AssignmentTask.objects.filter(group_id__in=assigned_ids)


def instructor_submission_qs(user):
    """Submissions for tasks in *user*'s assigned groups."""
    from apps.assignments.models import Submission  # noqa: PLC0415
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return Submission.objects.filter(task__group_id__in=assigned_ids)


def instructor_document_qs(user):
    """Documents belonging to *user*'s assigned groups."""
    from apps.documents.models import Document  # noqa: PLC0415
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return Document.objects.filter(group_id__in=assigned_ids)


def instructor_shared_upload_qs(user):
    """ParticipantSharedDocs belonging to *user*'s assigned groups."""
    from apps.documents.models import ParticipantSharedDoc  # noqa: PLC0415
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    assigned_ids = GroupInstructor.objects.filter(instructor=user).values_list("group_id", flat=True)
    return ParticipantSharedDoc.objects.filter(group_id__in=assigned_ids)


def instructor_owns_group(user, group_id) -> bool:
    """Return True if *user* (INSTRUCTOR) is assigned to *group_id*."""
    from apps.groups.models import GroupInstructor  # noqa: PLC0415

    return GroupInstructor.objects.filter(instructor=user, group_id=group_id).exists()
