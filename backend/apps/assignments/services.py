from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import log_action
from apps.groups.models import GroupMembership

from .models import AssignmentTask, Submission


class AssignmentError(Exception):
    def __init__(self, code: str, message: str, http: int = 422) -> None:
        self.code = code
        self.message = message
        self.http = http


@transaction.atomic
def create_submission(
    *,
    task: AssignmentTask,
    user,
    file_url: str,
    file_name: str,
    file_type: str,
    file_size: int,
    note: str = "",
    actor,
) -> Submission:
    """
    Create a submission. BR-13: attendance is NOT checked.
    Enforces late_policy. Re-uploads create a new version row (history preserved).
    """
    now = timezone.now()
    is_admin = actor.role == "ADMIN"

    # Group membership check (participants only)
    if not is_admin:
        in_group = GroupMembership.objects.filter(group=task.group, user=user).exists()
        if not in_group:
            raise AssignmentError("perm.not_in_group", "You are not in this group", 403)

    past_deadline = now > task.deadline_at

    if past_deadline:
        if task.late_policy == AssignmentTask.LATE_STRICT:
            raise AssignmentError(
                "assignment.deadline_passed_strict",
                "The deadline has passed and this assignment does not allow late submissions.",
                422,
            )
        if task.late_policy == AssignmentTask.LATE_ADMIN_ONLY and not is_admin:
            raise AssignmentError(
                "assignment.deadline_admin_only",
                "Past the deadline: only an Admin can submit on your behalf.",
                403,
            )

    # Derive status
    if not past_deadline:
        sub_status = Submission.STATUS_SUBMITTED
    elif task.late_policy == AssignmentTask.LATE_ALLOWED:
        sub_status = Submission.STATUS_LATE
    else:
        # ADMIN_ONLY + actor is admin
        sub_status = Submission.STATUS_OVERRIDE

    # Version = max existing + 1
    max_ver = (
        Submission.objects.filter(task=task, user=user)
        .order_by("-version")
        .values_list("version", flat=True)
        .first()
    ) or 0
    new_version = max_ver + 1

    submission = Submission.objects.create(
        task=task,
        user=user,
        version=new_version,
        file_url=file_url,
        file_name=file_name,
        file_type=file_type,
        file_size=file_size,
        status=sub_status,
        submitted_at=now,
        submitted_by=actor,
        note=note,
    )

    log_action(
        actor=actor,
        action="assignment.submission_created",
        target_type="Submission",
        target_id=submission.id,
        metadata={
            "task_id": str(task.id),
            "user_id": str(user.id),
            "version": new_version,
            "status": sub_status,
        },
    )

    return submission
