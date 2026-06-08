from datetime import timedelta

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.actions import INSTRUCTOR_ASSIGNED, INSTRUCTOR_UNASSIGNED
from apps.audit.services import log_action
from apps.common.permissions import IsAdmin, IsInstructor
from apps.common.scoping import instructor_group_qs, instructor_owns_group

from . import services
from .filters import apply_group_filters
from .models import ClassGroup, GroupInstructor, GroupMembership
from .serializers import (
    BulkAddParticipantsSerializer,
    ClassGroupDetailSerializer,
    ClassGroupListSerializer,
    ClassGroupWriteSerializer,
    GroupInstructorAssignSerializer,
    GroupInstructorSerializer,
)

User = get_user_model()


class ClassGroupViewSet(ViewSet):
    serializer_class = ClassGroupListSerializer

    def get_permissions(self):
        write_actions = {
            "create",
            "partial_update",
            "destroy",
            "add_participants",
            "remove_participant",
            "unassign_instructor",
        }
        if self.action in write_actions:
            return [IsAdmin()]
        return [IsAuthenticated()]

    _INSTRUCTOR_DENIED = {
        "errors": [{"code": "perm.not_instructor_of_group", "message": "You are not assigned as instructor for this group."}],
        "data": None,
    }

    def _list_queryset(self, request: Request):
        qs = ClassGroup.objects.select_related("created_by").prefetch_related("instructors__instructor")
        if request.user.role == "PARTICIPANT":
            qs = qs.filter(memberships__user=request.user).distinct()
            qs = apply_group_filters(qs, request.query_params)
        elif request.user.role == "INSTRUCTOR":
            from apps.common.scoping import instructor_group_qs  # noqa: PLC0415
            qs = instructor_group_qs(request.user).select_related("created_by")
            qs = apply_group_filters(qs, request.query_params)
        else:
            qs = apply_group_filters(qs, request.query_params)
        return qs

    def list(self, request: Request) -> Response:
        qs = self._list_queryset(request)
        return Response({"data": ClassGroupListSerializer(qs, many=True).data})

    def create(self, request: Request) -> Response:
        serializer = ClassGroupWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save(created_by=request.user)
        log_action(
            actor=request.user,
            action="group.created",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"name": group.name},
        )
        detail = get_object_or_404(
            ClassGroup.objects.select_related("created_by").prefetch_related("memberships__user"),
            pk=group.pk,
        )
        return Response(
            {"data": ClassGroupDetailSerializer(detail).data},
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(
            ClassGroup.objects.select_related("created_by").prefetch_related("memberships__user"),
            pk=pk,
        )
        if request.user.role == "PARTICIPANT":
            if not group.memberships.filter(user=request.user).exists():
                return Response(
                    {
                        "errors": [{"code": "perm.not_in_group", "message": "Not a member of this group"}],
                        "data": None,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif request.user.role == "INSTRUCTOR":
            if not instructor_owns_group(request.user, group.pk):
                return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response({"data": ClassGroupDetailSerializer(group).data})

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup.objects.select_related("created_by"), pk=pk)
        serializer = ClassGroupWriteSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        log_action(
            actor=request.user,
            action="group.updated",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"name": group.name},
        )
        detail = get_object_or_404(
            ClassGroup.objects.select_related("created_by").prefetch_related("memberships__user"),
            pk=group.pk,
        )
        return Response({"data": ClassGroupDetailSerializer(detail).data})

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup, pk=pk)
        group.is_archived = True
        group.save()
        log_action(
            actor=request.user,
            action="group.archived",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"name": group.name},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="participants")
    def add_participants(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup, pk=pk)
        serializer = BulkAddParticipantsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.add_participants(
            group=group,
            user_ids=serializer.validated_data["user_ids"],
            actor=request.user,
        )
        return Response({"data": result})

    @action(detail=True, methods=["delete"], url_path="participants/(?P<user_id>[^/.]+)")
    def remove_participant(self, request: Request, pk: str | None = None, user_id: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup, pk=pk)
        services.remove_participant(group=group, user_id=user_id, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="instructors")
    def group_instructors(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup, pk=pk)

        if request.method == "GET":
            if request.user.role == "INSTRUCTOR":
                if not instructor_owns_group(request.user, group.pk):
                    return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
            elif request.user.role not in ("ADMIN",):
                return Response(
                    {"errors": [{"code": "perm.forbidden", "message": "Forbidden."}], "data": None},
                    status=status.HTTP_403_FORBIDDEN,
                )
            qs = GroupInstructor.objects.filter(group=group).select_related("instructor")
            return Response({"data": GroupInstructorSerializer(qs, many=True).data})

        # POST — Admin only
        if request.user.role != "ADMIN":
            return Response(
                {"errors": [{"code": "perm.forbidden", "message": "Only admins can assign instructors."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = GroupInstructorAssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        assigned_count = 0
        for uid in ser.validated_data["user_ids"]:
            gi, created = GroupInstructor.objects.get_or_create(
                group=group,
                instructor_id=uid,
                defaults={"assigned_by": request.user},
            )
            if created:
                assigned_count += 1
                log_action(
                    actor=request.user,
                    action=INSTRUCTOR_ASSIGNED,
                    target_type="User",
                    target_id=uid,
                    metadata={"group_id": str(group.id), "group_title": group.name},
                )
                new_instructor = gi.instructor
                from apps.notifications.services import create_inapp, notify_instructors  # noqa: PLC0415
                # Notify the newly assigned instructor
                create_inapp(
                    user=new_instructor,
                    type="GROUP_ASSIGNED",
                    title=f"Assigned to group: {group.name}",
                    body=f"You have been assigned as an instructor for group {group.name}.",
                    link=f"/instructor/groups/{group.id}",
                    dedupe_key=f"group_assigned:{group.id}:{new_instructor.id}",
                    payload={
                        "group_id": str(group.id),
                        "group_title": group.name,
                        "assigned_by": str(request.user.id),
                    },
                )
                # Notify existing co-instructors (excluding the newly added one)
                notify_instructors(
                    group=group,
                    notification_type="CO_INSTRUCTOR_ADDED",
                    title=f"New co-instructor on {group.name}",
                    body=(
                        f"{new_instructor.full_name or new_instructor.email} has joined "
                        f"you as an instructor on {group.name}."
                    ),
                    link=f"/instructor/groups/{group.id}",
                    payload={
                        "group_id": str(group.id),
                        "new_instructor_id": str(new_instructor.id),
                    },
                    actor=new_instructor,
                    dedupe_suffix=str(new_instructor.id),
                )
        skipped_count = len(ser.validated_data["user_ids"]) - assigned_count
        return Response({"data": {"assigned": assigned_count, "skipped": skipped_count}})

    @action(detail=True, methods=["delete"], url_path="instructors/(?P<user_id>[^/.]+)")
    def unassign_instructor(self, request: Request, pk: str | None = None, user_id: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup, pk=pk)
        gi = get_object_or_404(GroupInstructor, group=group, instructor_id=user_id)
        removed_instructor = gi.instructor
        gi.delete()
        log_action(
            actor=request.user,
            action=INSTRUCTOR_UNASSIGNED,
            target_type="User",
            target_id=user_id,
            metadata={"group_id": str(group.id), "group_title": group.name},
        )
        from apps.notifications.services import create_inapp  # noqa: PLC0415
        now_ts = timezone.now().strftime("%Y%m%d%H%M")
        create_inapp(
            user=removed_instructor,
            type="GROUP_UNASSIGNED",
            title=f"Removed from group: {group.name}",
            body=f"You have been removed as an instructor from group {group.name}.",
            link="/instructor/groups",
            dedupe_key=f"group_unassigned:{group.id}:{removed_instructor.id}:{now_ts}",
            payload={"group_id": str(group.id), "group_title": group.name},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request: Request, pk: str | None = None) -> Response:
        from apps.assignments.models import AssignmentTask, Submission
        from apps.attendance.models import AttendanceRecord, AttendanceSession

        group = get_object_or_404(ClassGroup, pk=pk)
        if request.user.role == "PARTICIPANT":
            if not GroupMembership.objects.filter(group=group, user=request.user).exists():
                return Response(
                    {"errors": [{"code": "perm.not_in_group", "message": "Not a member of this group"}], "data": None},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif request.user.role == "INSTRUCTOR":
            if not instructor_owns_group(request.user, group.pk):
                return Response(self._INSTRUCTOR_DENIED, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        member_count = GroupMembership.objects.filter(group=group).count()

        # Attendance trend — last 4 ISO weeks
        attendance_trend = []
        for i in range(3, -1, -1):
            week_start = (now - timedelta(weeks=i)).date()
            week_start -= timedelta(days=week_start.weekday())
            week_end = week_start + timedelta(days=6)
            sessions = AttendanceSession.objects.filter(
                class_obj__group=group,
                started_at__date__range=(week_start, week_end),
            )
            session_count = sessions.count()
            if session_count and member_count:
                records = AttendanceRecord.objects.filter(session__in=sessions).count()
                rate = round(records / (session_count * member_count) * 100, 1)
            else:
                rate = 0.0
            attendance_trend.append({"week": week_start.isoformat(), "rate": min(100.0, rate)})

        # Submission completion
        open_tasks = AssignmentTask.objects.filter(group=group, is_open=True).count()
        total_possible = open_tasks * member_count
        completed = (
            Submission.objects.filter(task__group=group)
            .values("user_id", "task_id")
            .distinct()
            .count()
        )
        submission_completion = {"completed": completed, "total": max(total_possible, completed)}

        # Top participants
        members = GroupMembership.objects.filter(group=group).select_related("user")
        participant_rows = []
        for m in members:
            att_sessions = AttendanceSession.objects.filter(class_obj__group=group).count()
            attended = AttendanceRecord.objects.filter(session__class_obj__group=group, user=m.user).count()
            att_rate = round(attended / att_sessions * 100, 1) if att_sessions else 0.0
            subs = Submission.objects.filter(user=m.user, task__group=group).values("task_id").distinct().count()
            participant_rows.append({
                "id": str(m.user.id),
                "name": m.user.full_name,
                "attendance_rate": min(100.0, att_rate),
                "submissions": subs,
            })
        participant_rows.sort(key=lambda x: (x["attendance_rate"], x["submissions"]), reverse=True)

        return Response({
            "data": {
                "attendance_trend": attendance_trend,
                "submission_completion": submission_completion,
                "top_participants": participant_rows[:5],
            }
        })


class MeGroupsView(APIView):
    """GET /me/groups — returns groups assigned to the current instructor."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request: Request) -> Response:
        from apps.common.visibility import instructor_can_view_all  # noqa: PLC0415

        qs = instructor_group_qs(request.user).prefetch_related("memberships")
        data = [
            {
                "id": str(g.id),
                "name": g.name,
                "participant_count": g.memberships.count(),
            }
            for g in qs
        ]
        return Response({
            "data": data,
            "effective_can_view_all": instructor_can_view_all(request.user),
        })
