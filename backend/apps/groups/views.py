import uuid as _uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.actions import SUB_MENTOR_ASSIGNED, SUB_MENTOR_UNASSIGNED
from apps.audit.services import log_action
from apps.common.permissions import IsAdmin, IsSubMentor
from apps.common.scoping import sub_mentor_group_qs, sub_mentor_owns_group

from . import services
from .filters import apply_group_filters
from .models import ClassGroup, GroupLeadMentor, GroupSubMentor, GroupMembership, SubGroup, SubGroupMembership
from .serializers import (
    BulkAddParticipantsSerializer,
    ClassGroupDetailSerializer,
    ClassGroupListSerializer,
    ClassGroupWriteSerializer,
    GroupLeadMentorSerializer,
    GroupLeadMentorWriteSerializer,
    GroupSubMentorAssignSerializer,
    GroupSubMentorSerializer,
    SubGroupSerializer,
    SubGroupWriteSerializer,
)

User = get_user_model()


def _is_lead_mentor_of(user, group_pk) -> bool:
    """Return True if user is the designated Lead Mentor of the given group."""
    return GroupLeadMentor.objects.filter(lead_mentor=user, group_id=group_pk).exists()


class ClassGroupViewSet(ViewSet):
    serializer_class = ClassGroupListSerializer

    def get_permissions(self):
        # add_participants, remove_participant, unassign_sub_mentor, group_sub_mentors (POST)
        # are no longer statically admin-only: Lead Mentors also need access (runtime checks below).
        # partial_update is no longer in admin_only_actions — LEAD_MENTOR
        # needs to edit their own group. Ownership is enforced at runtime below.
        admin_only_actions = {
            "create",
            "destroy",
            "lead_mentor",
        }
        if self.action in admin_only_actions:
            return [IsAdmin()]
        return [IsAuthenticated()]

    def _check_lead_mentor_or_super_admin(self, request, group_pk) -> bool:
        """True if caller is Super Admin or Lead Mentor of the given group."""
        return request.user.role == "ADMIN" or _is_lead_mentor_of(request.user, group_pk)

    _SUB_MENTOR_DENIED = {
        "errors": [{"code": "perm.not_sub_mentor_of_group", "message": "You are not assigned as a Sub-Mentor for this group."}],
        "data": None,
    }

    def _list_queryset(self, request: Request):
        qs = ClassGroup.objects.select_related("created_by").prefetch_related("sub_mentors__sub_mentor")
        if request.user.role == "PARTICIPANT":
            qs = qs.filter(memberships__user=request.user).distinct()
            qs = apply_group_filters(qs, request.query_params)
        elif request.user.role == "SUB_MENTOR":
            from apps.common.scoping import sub_mentor_group_qs  # noqa: PLC0415
            qs = sub_mentor_group_qs(request.user).select_related("created_by")
            qs = apply_group_filters(qs, request.query_params)
        else:
            qs = apply_group_filters(qs, request.query_params)

        # Lead Mentors always see their assigned groups (merged by PK to avoid distinct conflicts).
        lead_mentor_group_ids = list(GroupLeadMentor.objects.filter(lead_mentor=request.user).values_list("group_id", flat=True))
        if lead_mentor_group_ids:
            existing_pks = set(qs.values_list("pk", flat=True))
            combined_pks = existing_pks | set(lead_mentor_group_ids)
            qs = ClassGroup.objects.filter(pk__in=combined_pks).select_related("created_by").prefetch_related("sub_mentors__sub_mentor")

        return qs

    def list(self, request: Request) -> Response:
        qs = self._list_queryset(request)
        try:
            page_size = min(int(request.query_params.get("page_size", 50)), 200)
            page = max(int(request.query_params.get("page", 1)), 1)
        except (ValueError, TypeError):
            page_size, page = 50, 1
        offset = (page - 1) * page_size
        total = qs.count()
        items = qs[offset:offset + page_size]
        return Response({
            "data": ClassGroupListSerializer(items, many=True).data,
            "meta": {"total": total, "page": page, "page_size": page_size},
        })

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
            ClassGroup.objects.select_related("created_by").prefetch_related(
                "memberships__user",
                "lead_mentor_assignment__lead_mentor",
                "sub_mentors__sub_mentor",
            ),
            pk=group.pk,
        )
        return Response(
            {"data": ClassGroupDetailSerializer(detail).data},
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(
            ClassGroup.objects.select_related("created_by").prefetch_related(
                "memberships__user",
                "lead_mentor_assignment__lead_mentor",
                "sub_mentors__sub_mentor",
            ),
            pk=pk,
        )
        # Lead Mentors can always read their own group.
        if _is_lead_mentor_of(request.user, group.pk):
            return Response({"data": ClassGroupDetailSerializer(group).data})
        if request.user.role == "PARTICIPANT":
            if not group.memberships.filter(user=request.user).exists():
                return Response(
                    {
                        "errors": [{"code": "perm.not_in_group", "message": "Not a member of this group"}],
                        "data": None,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif request.user.role == "SUB_MENTOR":
            from apps.common.visibility import sub_mentor_can_view_all  # noqa: PLC0415
            if not sub_mentor_owns_group(request.user, group.pk) and not sub_mentor_can_view_all(request.user):
                return Response(self._SUB_MENTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        return Response({"data": ClassGroupDetailSerializer(group).data})

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        # Allow Super Admin, Lead Mentor of this group, or any assigned Sub-Mentor.
        user = request.user
        is_assigned_sub_mentor = (
            user.role == "SUB_MENTOR"
            and GroupSubMentor.objects.filter(sub_mentor=user, group_id=pk).exists()
        )
        if not self._check_lead_mentor_or_super_admin(request, pk) and not is_assigned_sub_mentor:
            return Response(
                {"errors": [{"code": "perm.lead_mentor_required", "message": "Only an admin, Lead Mentor, or assigned Sub-Mentor can edit this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        from django.db import transaction as _txn  # noqa: PLC0415
        with _txn.atomic():
            group = get_object_or_404(
                ClassGroup.objects.select_related("created_by").select_for_update(),
                pk=pk,
            )
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
            ClassGroup.objects.select_related("created_by").prefetch_related(
                "memberships__user",
                "lead_mentor_assignment__lead_mentor",
                "sub_mentors__sub_mentor",
            ),
            pk=group.pk,
        )
        return Response({"data": ClassGroupDetailSerializer(detail).data})

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        from django.db import transaction  # noqa: PLC0415
        from apps.attendance.models import AttendanceSession  # noqa: PLC0415
        from apps.scheduling.models import Class as ClassModel  # noqa: PLC0415

        group = get_object_or_404(ClassGroup, pk=pk)

        with transaction.atomic():
            group.is_archived = True
            group.save(update_fields=["is_archived"])
            AttendanceSession.objects.filter(
                class_obj__group=group, status="ACTIVE"
            ).update(status="ENDED", ended_at=timezone.now())
            ClassModel.objects.filter(
                group=group, status_cached="UPCOMING"
            ).update(status_cached="CANCELLED")

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
        is_assigned_sub_mentor = (
            request.user.role == "SUB_MENTOR"
            and sub_mentor_owns_group(request.user, pk)
        )
        if not self._check_lead_mentor_or_super_admin(request, pk) and not is_assigned_sub_mentor:
            raise PermissionDenied
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
        is_assigned_sub_mentor = (
            request.user.role == "SUB_MENTOR"
            and sub_mentor_owns_group(request.user, pk)
        )
        if not self._check_lead_mentor_or_super_admin(request, pk) and not is_assigned_sub_mentor:
            raise PermissionDenied
        group = get_object_or_404(ClassGroup, pk=pk)
        services.remove_participant(group=group, user_id=user_id, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="sub-mentors")
    def group_sub_mentors(self, request: Request, pk: str | None = None) -> Response:
        group = get_object_or_404(ClassGroup, pk=pk)

        if request.method == "GET":
            if request.user.role == "SUB_MENTOR":
                if not sub_mentor_owns_group(request.user, group.pk):
                    return Response(self._SUB_MENTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
            elif request.user.role not in ("ADMIN",):
                if not _is_lead_mentor_of(request.user, group.pk):
                    return Response(
                        {"errors": [{"code": "perm.forbidden", "message": "Forbidden."}], "data": None},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            qs = GroupSubMentor.objects.filter(group=group).select_related("sub_mentor")
            return Response({"data": GroupSubMentorSerializer(qs, many=True).data})

        # POST — Admin, Lead Mentor of this group, or Sub-Mentor assigned to this group
        is_assigned_sub_mentor = (
            request.user.role == "SUB_MENTOR"
            and sub_mentor_owns_group(request.user, group.pk)
        )
        if request.user.role != "ADMIN" and not _is_lead_mentor_of(request.user, group.pk) and not is_assigned_sub_mentor:
            return Response(
                {"errors": [{"code": "perm.forbidden", "message": "Only admins, the Lead Mentor, or an assigned Sub-Mentor can assign Sub-Mentors."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        from django.db import transaction  # noqa: PLC0415
        ser = GroupSubMentorAssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        promote = ser.validated_data.get("promote_participants", False)
        assigned_count = 0
        with transaction.atomic():
            for uid in ser.validated_data["user_ids"]:
                try:
                    user_obj = User.objects.select_for_update().get(pk=uid)
                except User.DoesNotExist:
                    continue
                if user_obj.role == "SUB_MENTOR":
                    pass
                elif user_obj.role == "PARTICIPANT" and promote:
                    GroupMembership.objects.filter(user=user_obj).delete()
                    SubGroupMembership.objects.filter(user=user_obj).delete()
                    user_obj.role = "SUB_MENTOR"
                    user_obj.save(update_fields=["role"])
                else:
                    continue
                gi, created = GroupSubMentor.objects.get_or_create(
                    group=group,
                    sub_mentor_id=uid,
                    defaults={"assigned_by": request.user},
                )
                if created:
                    assigned_count += 1
                    log_action(
                        actor=request.user,
                        action=SUB_MENTOR_ASSIGNED,
                        target_type="ClassGroup",
                        target_id=group.id,
                        metadata={"user_id": str(uid), "group_title": group.name},
                    )
                    new_sub_mentor = gi.sub_mentor
                    from apps.notifications.services import create_inapp, notify_sub_mentors  # noqa: PLC0415
                    create_inapp(
                        user=new_sub_mentor,
                        type="GROUP_ASSIGNED",
                        title=f"Assigned to group: {group.name}",
                        body=f"You have been assigned as a Sub-Mentor for group {group.name}.",
                        link=f"/sub-mentor/groups/{group.id}",
                        dedupe_key=f"group_assigned:{group.id}:{new_sub_mentor.id}:{_uuid.uuid4()}",
                        payload={
                            "group_id": str(group.id),
                            "group_title": group.name,
                            "assigned_by": str(request.user.id),
                        },
                    )
                    notify_sub_mentors(
                        group=group,
                        notification_type="CO_SUB_MENTOR_ADDED",
                        title=f"New co-Sub-Mentor on {group.name}",
                        body=(
                            f"{new_sub_mentor.full_name or new_sub_mentor.email} has joined "
                            f"you as a Sub-Mentor on {group.name}."
                        ),
                        link=f"/sub-mentor/groups/{group.id}",
                        payload={
                            "group_id": str(group.id),
                            "new_sub_mentor_id": str(new_sub_mentor.id),
                        },
                        actor=new_sub_mentor,
                        dedupe_suffix=str(new_sub_mentor.id),
                    )
        skipped_count = len(ser.validated_data["user_ids"]) - assigned_count
        return Response({"data": {"assigned": assigned_count, "skipped": skipped_count}})

    @action(detail=True, methods=["delete"], url_path="sub-mentors/(?P<user_id>[^/.]+)")
    def unassign_sub_mentor(self, request: Request, pk: str | None = None, user_id: str | None = None) -> Response:
        is_assigned_sub_mentor = (
            request.user.role == "SUB_MENTOR"
            and sub_mentor_owns_group(request.user, pk)
        )
        if not self._check_lead_mentor_or_super_admin(request, pk) and not is_assigned_sub_mentor:
            raise PermissionDenied
        group = get_object_or_404(ClassGroup, pk=pk)
        gi = get_object_or_404(GroupSubMentor, group=group, sub_mentor_id=user_id)
        removed_sub_mentor = gi.sub_mentor
        gi.delete()
        log_action(
            actor=request.user,
            action=SUB_MENTOR_UNASSIGNED,
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"user_id": str(user_id), "group_title": group.name},
        )
        from apps.notifications.services import create_inapp  # noqa: PLC0415
        now_ts = timezone.now().strftime("%Y%m%d%H%M")
        create_inapp(
            user=removed_sub_mentor,
            type="GROUP_UNASSIGNED",
            title=f"Removed from group: {group.name}",
            body=f"You have been removed as a Sub-Mentor from group {group.name}.",
            link="/sub-mentor/groups",
            dedupe_key=f"group_unassigned:{group.id}:{removed_sub_mentor.id}:{now_ts}",
            payload={"group_id": str(group.id), "group_title": group.name},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="available-sub-mentors")
    def available_sub_mentors(self, request: Request, pk: str | None = None) -> Response:
        """GET /groups/{id}/available-sub-mentors/ — list Sub-Mentors not yet in this group.
        Accessible to ADMIN or the LEAD_MENTOR of this group.
        """
        is_assigned_sub_mentor = (
            request.user.role == "SUB_MENTOR"
            and sub_mentor_owns_group(request.user, pk)
        )
        if not self._check_lead_mentor_or_super_admin(request, pk) and not is_assigned_sub_mentor:
            return Response(
                {"errors": [{"code": "perm.forbidden", "message": "Forbidden."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        group = get_object_or_404(ClassGroup, pk=pk)
        already_assigned = GroupSubMentor.objects.filter(group=group).values_list("sub_mentor_id", flat=True)
        q = request.query_params.get("search", "").strip()
        qs = User.objects.filter(role="SUB_MENTOR", is_active=True).exclude(id__in=already_assigned)
        if q:
            from django.db.models import Q  # noqa: PLC0415
            qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q))
        data = [{"id": str(u.id), "full_name": u.full_name, "email": u.email} for u in qs.order_by("full_name")]
        return Response({"data": data})

    @action(detail=True, methods=["get", "put", "delete"], url_path="lead-mentor")
    def lead_mentor(self, request: Request, pk: str | None = None) -> Response:
        """GET/PUT/DELETE the Lead Mentor of a specific group."""
        group = get_object_or_404(ClassGroup, pk=pk)

        if request.method == "GET":
            try:
                ga = group.lead_mentor_assignment
                return Response({"data": GroupLeadMentorSerializer(ga).data})
            except GroupLeadMentor.DoesNotExist:
                return Response({"data": None})

        if request.method == "PUT":
            write_ser = GroupLeadMentorWriteSerializer(data=request.data)
            write_ser.is_valid(raise_exception=True)
            try:
                user = User.objects.get(id=write_ser.validated_data["user_id"])
            except User.DoesNotExist:
                return Response(
                    {"errors": [{"code": "user.not_found", "message": "User not found."}], "data": None},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ga, _ = GroupLeadMentor.objects.update_or_create(
                group=group,
                defaults={"lead_mentor": user, "assigned_by": request.user},
            )
            # Promote to LEAD_MENTOR role if they had a different role
            if user.role != "LEAD_MENTOR":
                user.role = "LEAD_MENTOR"
                user.save(update_fields=["role"])
            # Send congratulations notification
            from apps.notifications.services import create_inapp  # noqa: PLC0415
            create_inapp(
                user=user,
                type="LEAD_MENTOR_ASSIGNED",
                title=f"Congratulations! You are now Lead Mentor of {group.name}",
                body=(
                    f"You have been assigned as the Lead Mentor of {group.name}. "
                    f"You can now manage participants, Sub-Mentors, and monitor analytics for your batch."
                ),
                link="/lead-mentor/dashboard",
                dedupe_key=f"lead_mentor_assigned:{group.id}:{user.id}:{_uuid.uuid4()}",
                payload={"group_id": str(group.id), "group_name": group.name},
            )
            log_action(
                actor=request.user,
                action="group.lead_mentor_assigned",
                target_type="ClassGroup",
                target_id=group.id,
                metadata={"user_id": str(user.id), "group_name": group.name},
            )
            return Response({"data": GroupLeadMentorSerializer(ga).data})

        if request.method == "DELETE":
            try:
                existing_lm = GroupLeadMentor.objects.get(group=group)
                removed_user_id = str(existing_lm.lead_mentor_id)
            except GroupLeadMentor.DoesNotExist:
                removed_user_id = "unknown"
            GroupLeadMentor.objects.filter(group=group).delete()
            log_action(
                actor=request.user,
                action="group.lead_mentor_removed",
                target_type="ClassGroup",
                target_id=group.id,
                metadata={"user_id": removed_user_id, "group_name": group.name},
            )
            return Response(status=204)

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request: Request, pk: str | None = None) -> Response:
        from apps.assignments.models import AssignmentTask, Submission
        from apps.attendance.models import AttendanceRecord, AttendanceSession

        group = get_object_or_404(ClassGroup, pk=pk)
        user = request.user
        if user.role == "ADMIN" or _is_lead_mentor_of(user, group.pk):
            pass  # allowed
        elif user.role == "PARTICIPANT":
            if not GroupMembership.objects.filter(group=group, user=user).exists():
                return Response(
                    {"errors": [{"code": "perm.not_in_group", "message": "Not a member of this group"}], "data": None},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif user.role == "SUB_MENTOR":
            if not sub_mentor_owns_group(user, group.pk):
                return Response(self._SUB_MENTOR_DENIED, status=status.HTTP_403_FORBIDDEN)
        else:
            raise PermissionDenied

        now = timezone.now()

        # Optional sub-group filter
        sub_group_id = request.query_params.get('sub_group_id')
        if sub_group_id:
            try:
                sub_group = SubGroup.objects.get(pk=sub_group_id, parent_group=group)
            except SubGroup.DoesNotExist:
                return Response({'detail': 'Sub-group not found.'}, status=404)
            member_qs = SubGroupMembership.objects.filter(sub_group=sub_group).select_related('user')
            member_ids = list(member_qs.values_list('user_id', flat=True))
            member_count = len(member_ids)
            members_iter = member_qs
        else:
            member_count = GroupMembership.objects.filter(group=group).count()
            members_iter = GroupMembership.objects.filter(group=group).select_related('user')
            member_ids = None

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
                records_qs = AttendanceRecord.objects.filter(session__in=sessions)
                if member_ids is not None:
                    records_qs = records_qs.filter(user_id__in=member_ids)
                records = records_qs.count()
                rate = round(records / (session_count * member_count) * 100, 1)
            else:
                rate = 0.0
            attendance_trend.append({"week": week_start.isoformat(), "rate": min(100.0, rate)})

        # Submission completion
        open_tasks = AssignmentTask.objects.filter(group=group, is_open=True).count()
        total_possible = open_tasks * member_count
        subs_qs = Submission.objects.filter(task__group=group)
        if member_ids is not None:
            subs_qs = subs_qs.filter(user_id__in=member_ids)
        completed = subs_qs.values("user_id", "task_id").distinct().count()
        submission_completion = {"completed": completed, "total": max(total_possible, completed)}

        # Top participants
        from django.db.models import Count as _Count  # noqa: PLC0415
        sessions_filter = {"class_obj__group": group}
        if sub_group_id:
            sessions_filter["class_obj__sub_group_id"] = sub_group_id
        att_sessions_total = AttendanceSession.objects.filter(**sessions_filter).count()

        records_filter = {"session__class_obj__group": group, "status": "PRESENT"}
        if sub_group_id:
            records_filter["session__class_obj__sub_group_id"] = sub_group_id
        attended_map = dict(
            AttendanceRecord.objects.filter(**records_filter)
            .values("user_id")
            .annotate(n=_Count("id"))
            .values_list("user_id", "n")
        )

        participant_rows = []
        for m in members_iter:
            user_obj = m.user
            attended = attended_map.get(m.user_id, 0)
            att_rate = round(attended / att_sessions_total * 100, 1) if att_sessions_total else 0.0
            subs = Submission.objects.filter(user=user_obj, task__group=group).values("task_id").distinct().count()
            participant_rows.append({
                "id": str(user_obj.id),
                "name": user_obj.full_name,
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


class SubGroupViewSet(ViewSet):
    """
    CRUD for sub-groups nested under a parent ClassGroup.
    URLs: /groups/<group_pk>/sub-groups/ and /groups/<group_pk>/sub-groups/<pk>/
    Write actions (create, partial_update, destroy) are Admin or Lead Mentor only.
    """
    permission_classes = [IsAuthenticated]

    def _caller_has_read_access(self, group_pk: str) -> bool:
        """True if caller may read sub-groups (Admin, Lead Mentor, assigned Sub-Mentor, or group member)."""
        user = self.request.user
        if user.role == "ADMIN" or _is_lead_mentor_of(user, group_pk):
            return True
        if user.role == "SUB_MENTOR":
            return sub_mentor_owns_group(user, group_pk)
        if user.role == "PARTICIPANT":
            return GroupMembership.objects.filter(user=user, group_id=group_pk).exists()
        return False

    def _caller_has_write_access(self) -> bool:
        """True if caller is Admin, Lead Mentor of the group, or assigned Sub-Mentor."""
        user = self.request.user
        group_pk = self.kwargs.get("group_pk")
        if user.role == "ADMIN" or _is_lead_mentor_of(user, group_pk):
            return True
        if user.role == "SUB_MENTOR":
            return sub_mentor_owns_group(user, group_pk)
        return False

    def _get_group(self, group_pk: str) -> ClassGroup:
        return get_object_or_404(ClassGroup, pk=group_pk, is_archived=False)

    def list(self, request: Request, group_pk: str | None = None) -> Response:
        if not self._caller_has_read_access(group_pk):
            return Response(
                {"errors": [{"code": "perm.forbidden", "message": "You do not have access to this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        group = self._get_group(group_pk)
        sub_groups = (
            SubGroup.objects
            .filter(parent_group=group)
            .prefetch_related('memberships__user')
        )
        return Response({'data': SubGroupSerializer(sub_groups, many=True).data})

    def retrieve(self, request: Request, group_pk: str | None = None, pk: str | None = None) -> Response:
        if not self._caller_has_read_access(group_pk):
            return Response(
                {"errors": [{"code": "perm.forbidden", "message": "You do not have access to this group."}], "data": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        group = self._get_group(group_pk)
        sub_group = get_object_or_404(
            SubGroup.objects.prefetch_related('memberships__user'),
            pk=pk,
            parent_group=group,
        )
        return Response({'data': SubGroupSerializer(sub_group).data})

    def create(self, request: Request, group_pk: str | None = None) -> Response:
        if not self._caller_has_write_access():
            return Response({'detail': 'Admin only.'}, status=403)
        group = self._get_group(group_pk)

        serializer = SubGroupWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Validate participants are members of parent group
        user_ids = [str(uid) for uid in data.get('user_ids', [])]
        if user_ids:
            valid_ids = set(
                str(uid) for uid in
                GroupMembership.objects.filter(group=group).values_list('user_id', flat=True)
            )
            invalid = set(user_ids) - valid_ids
            if invalid:
                return Response(
                    {'detail': f'The following users are not members of this group: {", ".join(sorted(invalid))}'},
                    status=400,
                )

        # Unique name check
        if SubGroup.objects.filter(parent_group=group, name=data['name']).exists():
            return Response({'detail': 'A sub-group with this name already exists in this group.'}, status=400)

        sub_group = SubGroup.objects.create(
            parent_group=group,
            name=data['name'],
            created_by=request.user,
        )
        if user_ids:
            SubGroupMembership.objects.bulk_create(
                [SubGroupMembership(sub_group=sub_group, user_id=uid) for uid in user_ids],
                ignore_conflicts=True,
            )

        sub_group.refresh_from_db()
        log_action(
            actor=request.user,
            action="sub_group.created",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"sub_group_id": str(sub_group.id), "name": sub_group.name},
        )
        return Response(
            {'data': SubGroupSerializer(
                SubGroup.objects.prefetch_related('memberships__user').get(pk=sub_group.pk)
            ).data},
            status=201,
        )

    def partial_update(self, request: Request, group_pk: str | None = None, pk: str | None = None) -> Response:
        if not self._caller_has_write_access():
            return Response({'detail': 'Admin only.'}, status=403)
        group = self._get_group(group_pk)
        sub_group = get_object_or_404(SubGroup, pk=pk, parent_group=group)

        if 'name' in request.data:
            new_name = str(request.data['name']).strip()
            if SubGroup.objects.filter(parent_group=group, name=new_name).exclude(pk=pk).exists():
                return Response({'detail': 'A sub-group with this name already exists in this group.'}, status=400)
            sub_group.name = new_name

        if 'user_ids' in request.data:
            user_ids = [str(uid) for uid in request.data.get('user_ids', [])]
            valid_ids = set(
                str(uid) for uid in
                GroupMembership.objects.filter(group=group).values_list('user_id', flat=True)
            )
            invalid = set(user_ids) - valid_ids
            if invalid:
                return Response(
                    {'detail': f'The following users are not members of this group: {", ".join(sorted(invalid))}'},
                    status=400,
                )
            SubGroupMembership.objects.filter(sub_group=sub_group).delete()
            if user_ids:
                SubGroupMembership.objects.bulk_create(
                    [SubGroupMembership(sub_group=sub_group, user_id=uid) for uid in user_ids],
                    ignore_conflicts=True,
                )

        sub_group.save()
        log_action(
            actor=request.user,
            action="sub_group.updated",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"sub_group_id": str(sub_group.id), "name": sub_group.name},
        )
        return Response({
            'data': SubGroupSerializer(
                SubGroup.objects.prefetch_related('memberships__user').get(pk=sub_group.pk)
            ).data
        })

    def destroy(self, request: Request, group_pk: str | None = None, pk: str | None = None) -> Response:
        if not self._caller_has_write_access():
            return Response({'detail': 'Admin only.'}, status=403)
        group = self._get_group(group_pk)
        sub_group = get_object_or_404(SubGroup, pk=pk, parent_group=group)
        sub_group_name = sub_group.name
        sub_group_id = str(sub_group.id)
        sub_group.delete()
        log_action(
            actor=request.user,
            action="sub_group.deleted",
            target_type="ClassGroup",
            target_id=group.id,
            metadata={"sub_group_id": sub_group_id, "name": sub_group_name},
        )
        return Response(status=204)


class MeGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from apps.common.scoping import lead_mentor_group_qs  # noqa: PLC0415
        from apps.common.visibility import sub_mentor_can_view_all  # noqa: PLC0415

        if request.user.role == "LEAD_MENTOR":
            qs = lead_mentor_group_qs(request.user).prefetch_related("memberships")
            data = [
                {"id": str(g.id), "name": g.name, "participant_count": g.memberships.count()}
                for g in qs
            ]
            return Response({"data": data, "effective_can_view_all": False})

        if request.user.role == "SUB_MENTOR":
            qs = sub_mentor_group_qs(request.user).prefetch_related("memberships")
            data = [
                {"id": str(g.id), "name": g.name, "participant_count": g.memberships.count()}
                for g in qs
            ]
            return Response({
                "data": data,
                "effective_can_view_all": sub_mentor_can_view_all(request.user),
            })

        return Response(
            {"errors": [{"code": "perm.forbidden", "message": "Forbidden."}], "data": None},
            status=403,
        )
