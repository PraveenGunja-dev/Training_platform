from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.services import log_action
from apps.common.permissions import IsAdmin
from apps.common.file_validation import FileValidationError, validate_file
from apps.common.scoping import instructor_assignment_qs, instructor_owns_group
from apps.groups.models import GroupMembership

from .filters import apply_task_filters, participant_task_qs
from .models import AssignmentTask, Submission, SubmissionReview
from .serializers import (
    AssignmentTaskSerializer,
    AssignmentTaskWriteSerializer,
    SubmissionReviewSerializer,
    SubmissionSerializer,
)
from .services import AssignmentError, create_submission

User = get_user_model()


def _error_response(exc: AssignmentError | FileValidationError) -> Response:
    code = exc.code  # type: ignore[union-attr]
    message = exc.message  # type: ignore[union-attr]
    http = getattr(exc, "http", 422)
    return Response(
        {"errors": [{"code": code, "message": message}], "data": None},
        status=http,
    )


def _validation_error(field: str, message: str, code: str = "invalid") -> Response:
    return Response(
        {"errors": [{"code": code, "message": message, "field": field}], "data": None},
        status=status.HTTP_400_BAD_REQUEST,
    )


# ---------------------------------------------------------------------------
# AssignmentTaskViewSet — CRUD + question-file + submissions
# ---------------------------------------------------------------------------


class AssignmentTaskViewSet(ViewSet):
    serializer_class = AssignmentTaskSerializer

    _INSTRUCTOR_DENIED = {
        "errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}],
        "data": None,
    }

    def _base_qs(self):
        return AssignmentTask.objects.defer('question_file_data').select_related("group", "class_obj", "created_by")

    # GET /assignments
    def list(self, request: Request) -> Response:
        if request.user.role == "ADMIN":
            qs = self._base_qs()
            qs = apply_task_filters(qs, request.query_params)
        elif request.user.role == "INSTRUCTOR":
            qs = instructor_assignment_qs(request.user).select_related("group", "class_obj", "created_by")
            qs = apply_task_filters(qs, request.query_params)
        else:
            qs = participant_task_qs(request.user)
            qs = apply_task_filters(qs, request.query_params)
        qs = qs.order_by("deadline_at")
        return Response({"data": AssignmentTaskSerializer(qs, many=True).data})

    # POST /assignments (Admin or Instructor on assigned group)
    def create(self, request: Request) -> Response:
        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = AssignmentTaskWriteSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"errors": [{"code": "validation_error", "message": str(ser.errors)}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.role == "INSTRUCTOR":
            group = ser.validated_data.get("group")
            group_id = group.pk if group else None
            if not group_id or not instructor_owns_group(request.user, group_id):
                return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        task = AssignmentTask.objects.create(
            created_by=request.user,
            **ser.validated_data,
        )

        # If the upload window has already started, open immediately and notify.
        now = timezone.now()
        if not task.is_open and task.upload_open_at <= now and not task.is_closed:
            task.is_open = True
            task.save(update_fields=["is_open"])
            from .tasks import _notify_task_opened
            _notify_task_opened(task, now)
        elif task.class_obj_id:
            # Task is linked to a class but not yet open — notify participants now
            # so they know it's coming (deep link goes to the class page)
            from apps.notifications.models import Notification
            open_str = task.upload_open_at.strftime("%d %b %Y, %I:%M %p")
            member_ids = list(
                GroupMembership.objects.filter(group_id=task.group_id)
                .values_list("user_id", flat=True)
            )
            Notification.objects.bulk_create(
                [
                    Notification(
                        user_id=uid,
                        type="CLASS_TASK_ASSIGNED",
                        title=f"Assignment allocated: {task.title}",
                        body=f'"{task.title}" has been assigned to your class. Opens {open_str}.',
                        link=f"/me/classes/{task.class_obj_id}",
                        dedupe_key=f"class_task_assigned:{task.id}:{uid}",
                        sent_at=now,
                        payload={"task_id": str(task.id), "class_id": str(task.class_obj_id)},
                    )
                    for uid in member_ids
                ],
                ignore_conflicts=True,
                batch_size=500,
            )

        log_action(
            actor=request.user,
            action="assignment.task_created",
            target_type="AssignmentTask",
            target_id=task.id,
            metadata={
                "title": task.title,
                "group_id": str(task.group_id),
                "class_id": str(task.class_obj_id) if task.class_obj_id else None,
            },
        )
        # Notify co-instructors (excluding the creator) about new assignment
        from apps.notifications.services import notify_instructors as _ni_assign  # noqa: PLC0415
        deadline_str = task.deadline_at.strftime("%d %b %Y, %I:%M %p") if task.deadline_at else "no deadline"
        _ni_assign(
            group=task.group,
            notification_type="ASSIGNMENT_CREATED_IN_GROUP",
            title=f"New assignment: {task.title}",
            body=f'New assignment "{task.title}" posted in {task.group.name} — due {deadline_str}.',
            link=f"/instructor/assignments/{task.id}",
            payload={"task_id": str(task.id), "group_id": str(task.group_id)},
            actor=request.user,
            dedupe_suffix=str(task.id),
        )
        return Response(
            {"data": AssignmentTaskSerializer(task).data},
            status=status.HTTP_201_CREATED,
        )

    # GET /assignments/:id
    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        task = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "ADMIN":
            pass
        elif request.user.role == "INSTRUCTOR":
            if not instructor_owns_group(request.user, task.group_id):
                return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        else:
            # Participants can only see tasks that are open or whose window has started
            in_group = GroupMembership.objects.filter(
                group=task.group, user=request.user
            ).exists()
            now = timezone.now()
            task_visible = task.is_open or (task.upload_open_at <= now and not task.is_closed)
            if not in_group or not task_visible:
                return Response(
                    {"errors": [{"code": "perm.denied", "message": "Not found or not accessible."}], "data": None},
                    status=status.HTTP_404_NOT_FOUND,
                )
        return Response({"data": AssignmentTaskSerializer(task).data})

    # PATCH /assignments/:id (Admin or Instructor on assigned group)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        task = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        ser = AssignmentTaskWriteSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return Response(
                {"errors": [{"code": "validation_error", "message": str(ser.errors)}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        was_open = task.is_open
        for field, value in ser.validated_data.items():
            setattr(task, field, value)
        task.save()

        # If admin just manually opened the task, notify group members.
        if not was_open and task.is_open:
            from .tasks import _notify_task_opened
            _notify_task_opened(task, timezone.now())

        log_action(
            actor=request.user,
            action="assignment.task_updated",
            target_type="AssignmentTask",
            target_id=task.id,
            metadata={"fields_changed": list(ser.validated_data.keys())},
        )
        return Response({"data": AssignmentTaskSerializer(task).data})

    # DELETE /assignments/:id (Admin or Instructor on assigned group)
    def destroy(self, request: Request, pk: str | None = None) -> Response:
        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        task = get_object_or_404(AssignmentTask, pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        task_id = task.id
        task.delete()
        log_action(
            actor=request.user,
            action="assignment.task_deleted",
            target_type="AssignmentTask",
            target_id=task_id,
            metadata={},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # POST /assignments/:id/submissions
    def submit(self, request: Request, pk: str | None = None) -> Response:
        task = get_object_or_404(AssignmentTask.objects.select_related("group"), pk=pk)

        # Instructors may only submit to tasks in groups they own
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)

        file = request.FILES.get('file')
        if not file:
            return _validation_error('file', 'This field is required.')

        file_data = file.read()
        file_name = file.name
        file_type = file.content_type
        file_size = file.size

        try:
            validate_file(file_name, file_size, file_type)
        except FileValidationError as exc:
            return _error_response(exc)

        note = request.data.get('note', '')
        user_id = request.data.get('user_id')

        # Determine target user: Admin can specify user_id for on-behalf submission
        if user_id and request.user.role == "ADMIN":
            target_user = get_object_or_404(User, pk=user_id)
        else:
            target_user = request.user

        try:
            submission = create_submission(
                task=task,
                user=target_user,
                file_data=file_data,
                file_name=file_name,
                file_type=file_type,
                file_size=file_size,
                note=note,
                actor=request.user,
            )
        except AssignmentError as exc:
            return _error_response(exc)

        # Notify instructors of the submission (respects digest_submissions preference)
        from apps.notifications.models import NotificationPreference  # noqa: PLC0415
        from apps.notifications.services import create_inapp as _ci_s  # noqa: PLC0415
        from apps.groups.models import GroupInstructor as GroupInstructorModel  # noqa: PLC0415
        actor_name = target_user.full_name or target_user.email
        for gi in GroupInstructorModel.objects.filter(group=task.group).select_related("instructor"):
            prefs = NotificationPreference.objects.filter(user=gi.instructor).first()
            if prefs and prefs.digest_submissions:
                # Daily digest: one notification per task per day
                from django.utils import timezone as _tz_sub  # noqa: PLC0415
                day_suffix = _tz_sub.now().strftime("%Y%m%d")
                dedupe = f"submission_received:{task.id}:{gi.instructor.id}:{day_suffix}"
            else:
                dedupe = f"submission_received:{submission.id}:{gi.instructor.id}"
            _ci_s(
                user=gi.instructor,
                type="SUBMISSION_RECEIVED",
                title=f"Submission received: {task.title}",
                body=f"{actor_name} submitted {task.title}.",
                link=f"/instructor/assignments/{task.id}",
                dedupe_key=dedupe,
                payload={
                    "task_id": str(task.id),
                    "submission_id": str(submission.id),
                    "group_id": str(task.group_id),
                },
            )

        return Response(
            {"data": SubmissionSerializer(submission).data},
            status=status.HTTP_201_CREATED,
        )

    # POST /assignments/:id/close (Admin or Instructor on assigned group)
    def close(self, request: Request, pk: str | None = None) -> Response:
        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        task = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if task.is_closed:
            return Response(
                {"errors": [{"code": "assignment.already_closed", "detail": "This assignment is already closed."}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task.is_closed = True
        task.is_open = False
        task.save(update_fields=["is_closed", "is_open"])
        log_action(
            actor=request.user,
            action="assignment.task_closed",
            target_type="AssignmentTask",
            target_id=task.id,
            metadata={"title": task.title},
        )
        return Response({"data": AssignmentTaskSerializer(task).data})

    # POST /assignments/:id/question-file — upload/replace question file
    def question_file_upload(self, request: Request, pk: str | None = None) -> Response:
        """POST /assignments/{id}/question-file — upload/replace question file."""
        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        task = get_object_or_404(self._base_qs(), pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        file = request.FILES.get('file')
        if not file:
            return _validation_error('file', 'This field is required.')
        file_bytes = file.read()
        file_name = file.name
        file_type = file.content_type
        file_size = file.size
        try:
            validate_file(file_name, file_size, file_type)
        except FileValidationError as exc:
            return _error_response(exc)
        task.question_file_data = file_bytes
        task.question_file_name = file_name
        task.question_file_type = file_type
        task.question_file_size = file_size
        task.save(update_fields=['question_file_data', 'question_file_name', 'question_file_type', 'question_file_size'])
        return Response({"data": AssignmentTaskSerializer(task).data})

    # GET /assignments/:id/question-file — stream question file binary
    def question_file_download(self, request: Request, pk: str | None = None) -> Response:
        """GET /assignments/{id}/question-file — stream question file binary."""
        task = get_object_or_404(
            AssignmentTask.objects.only('id', 'question_file_data', 'question_file_name', 'question_file_type', 'group_id'),
            pk=pk,
        )
        # Verify access
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        if not task.question_file_data:
            return Response(
                {"errors": [{"code": "not_found", "message": "No question file attached."}], "data": None},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.http import HttpResponse
        import urllib.parse
        response = HttpResponse(bytes(task.question_file_data), content_type=task.question_file_type)
        safe_name = urllib.parse.quote(task.question_file_name)
        response['Content-Disposition'] = f'attachment; filename="{task.question_file_name}"; filename*=UTF-8\'\'{safe_name}'
        response['Content-Length'] = len(task.question_file_data)
        return response

    # GET /assignments/:id/submissions (Admin or Instructor on assigned group)
    def list_submissions(self, request: Request, pk: str | None = None) -> Response:
        if request.user.role not in ("ADMIN", "INSTRUCTOR"):
            return Response(
                {"errors": [{"code": "perm.admin_required", "message": "Admin access required."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        task = get_object_or_404(AssignmentTask, pk=pk)
        if request.user.role == "INSTRUCTOR" and not instructor_owns_group(request.user, task.group_id):
            return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        subs = (
            Submission.objects.filter(task=task)
            .select_related("user", "submitted_by")
            .order_by("user__full_name", "-version")
        )
        status_param = request.query_params.get("status")
        if status_param:
            subs = subs.filter(status=status_param)
        search_param = request.query_params.get("search")
        if search_param:
            subs = subs.filter(user__full_name__icontains=search_param)
        return Response({"data": SubmissionSerializer(subs, many=True).data})


# ---------------------------------------------------------------------------
# Participant: /me/tasks
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class ParticipantTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = participant_task_qs(request.user)
        return Response({"data": AssignmentTaskSerializer(qs, many=True).data})


# ---------------------------------------------------------------------------
# Participant: /me/submissions
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class ParticipantSubmissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        subs = (
            Submission.objects.filter(user=request.user)
            .select_related("task")
            .order_by("-submitted_at")
        )
        return Response({"data": SubmissionSerializer(subs, many=True).data})


# ---------------------------------------------------------------------------
# File download: /submissions/:id/file
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class SubmissionFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: str) -> Response:
        sub = get_object_or_404(
            Submission.objects.select_related("task__group").only(
                'id', 'file_data', 'file_name', 'file_type', 'user_id', 'task__group_id'
            ),
            pk=pk,
        )
        if request.user.role == "INSTRUCTOR":
            if not instructor_owns_group(request.user, sub.task.group_id):
                return Response(
                    {"errors": [{"code": "perm.denied", "message": "Access denied."}], "data": None},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif request.user.role != "ADMIN" and sub.user_id != request.user.id:
            return Response(
                {"errors": [{"code": "perm.denied", "message": "Access denied."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not sub.file_data:
            return Response(
                {"errors": [{"code": "not_found", "message": "File not available."}], "data": None},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.http import HttpResponse
        import urllib.parse
        response = HttpResponse(bytes(sub.file_data), content_type=sub.file_type)
        safe_name = urllib.parse.quote(sub.file_name)
        response['Content-Disposition'] = f'attachment; filename="{sub.file_name}"; filename*=UTF-8\'\'{safe_name}'
        response['Content-Length'] = len(sub.file_data)
        return response


# ---------------------------------------------------------------------------
# Submission Review: GET + POST /assignments/submissions/{id}/review
# ---------------------------------------------------------------------------


@extend_schema(exclude=True)
class SubmissionReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_submission(self, submission_id):
        try:
            return Submission.objects.select_related("task__group", "user").get(pk=submission_id)
        except Submission.DoesNotExist:
            return None

    def _can_review(self, submission, user) -> bool:
        """Admin: any group. Instructor: only assigned groups."""
        if user.role == "ADMIN":
            return True
        if user.role == "INSTRUCTOR":
            return instructor_owns_group(user, submission.task.group_id)
        return False

    def get(self, request: Request, submission_id) -> Response:
        submission = self._get_submission(submission_id)
        if submission is None:
            return Response(
                {"errors": [{"code": "not_found", "message": "Submission not found."}]},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = request.user
        if user.role == "PARTICIPANT" and submission.user_id != user.pk:
            return Response(
                {"errors": [{"code": "permission_denied", "message": "Not your submission."}]},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.role == "INSTRUCTOR" and not self._can_review(submission, user):
            return Response(
                {"errors": [{"code": "permission_denied", "message": "Not in your group."}]},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            review = submission.review
            return Response({"data": SubmissionReviewSerializer(review).data})
        except SubmissionReview.DoesNotExist:
            return Response({"data": None})

    def post(self, request: Request, submission_id) -> Response:
        if request.user.role == "PARTICIPANT":
            return Response(
                {"errors": [{"code": "permission_denied", "message": "Participants cannot submit reviews."}]},
                status=status.HTTP_403_FORBIDDEN,
            )
        submission = self._get_submission(submission_id)
        if submission is None:
            return Response(
                {"errors": [{"code": "not_found", "message": "Submission not found."}]},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not self._can_review(submission, request.user):
            return Response(
                {"errors": [{"code": "permission_denied", "message": "Not in your group."}]},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            existing_review = submission.review
        except SubmissionReview.DoesNotExist:
            existing_review = None

        is_new = existing_review is None
        ser = SubmissionReviewSerializer(
            existing_review,
            data=request.data,
            partial=not is_new,
        )
        if not ser.is_valid():
            return Response(
                {"errors": [{"code": "validation_error", "message": str(ser.errors)}]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        validated = ser.validated_data

        from django.core.exceptions import ValidationError as DjangoValidationError  # noqa: PLC0415
        try:
            _tmp_review = SubmissionReview(
                submission=submission,
                reviewer=request.user,
                **validated,
            )
            _tmp_review.full_clean(exclude=["submission", "reviewer"])
        except DjangoValidationError as e:
            return Response(
                {"errors": [{"code": "validation_error", "message": str(e)}], "data": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_new:
            review = SubmissionReview.objects.create(
                submission=submission,
                reviewer=request.user,
                **validated,
            )
        else:
            for field, value in validated.items():
                setattr(existing_review, field, value)
            existing_review.reviewer = request.user
            existing_review.save()
            review = existing_review

        from apps.audit.services import log_action as _log_review  # noqa: PLC0415
        _log_review(
            actor=request.user,
            action="assignment.submission_reviewed",
            target_type="SubmissionReview",
            target_id=review.id,
            metadata={
                "task_id": str(submission.task_id),
                "class_id": str(submission.task.class_obj_id) if submission.task.class_obj_id else None,
                "user_id": str(submission.user_id),
                "grade_letter": review.grade_letter or "",
                "is_new": is_new,
            },
        )

        # Notify the participant that their submission has been reviewed
        from apps.notifications.services import create_inapp as _ci_reviewed  # noqa: PLC0415
        from django.utils import timezone as _tz  # noqa: PLC0415

        if is_new:
            _ci_reviewed(
                user=submission.user,
                type="SUBMISSION_REVIEWED",
                title="Your submission has been reviewed",
                body=f'Your submission for "{submission.task.title}" has been reviewed.',
                link=f"/me/tasks/{submission.task_id}",
                dedupe_key=f"submission_reviewed:{submission.id}",
                payload={
                    "task_id": str(submission.task_id),
                    "submission_id": str(submission.id),
                },
            )
        else:
            today = _tz.now().strftime("%Y%m%d")
            _ci_reviewed(
                user=submission.user,
                type="SUBMISSION_REVIEWED",
                title="Your submission review was updated",
                body=f'The review for your submission on "{submission.task.title}" has been updated.',
                link=f"/me/tasks/{submission.task_id}",
                dedupe_key=f"submission_review_updated:{submission.id}:{today}",
                payload={
                    "task_id": str(submission.task_id),
                    "submission_id": str(submission.id),
                },
            )

        return Response(
            {"data": SubmissionReviewSerializer(review).data},
            status=status.HTTP_201_CREATED if is_new else status.HTTP_200_OK,
        )
