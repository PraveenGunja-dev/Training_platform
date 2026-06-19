from __future__ import annotations

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.services import invite_user
from apps.accounts.throttles import InviteRateThrottle
from apps.groups.models import GroupAdmin
from apps.audit.actions import INSTRUCTOR_VISIBILITY_CHANGED
from apps.audit.services import log_action
from apps.common.pagination import EnvelopePageNumberPagination
from apps.common.permissions import IsAdmin

from .filters import UserFilter
from .serializers import (
    BulkInviteSerializer,
    InstructorListSerializer,
    InviteSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserVisibilityUpdateSerializer,
    UserWriteSerializer,
)


class UserViewSet(
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
):
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = User.objects.all().order_by("-created_at")
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = UserFilter
    search_fields = ["email", "full_name", "employee_code"]
    ordering_fields = ["created_at", "full_name", "email"]

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action in ("update", "partial_update"):
            return UserWriteSerializer
        return UserDetailSerializer

    def get_throttles(self):
        if self.action in ("invite", "bulk_invite"):
            return [InviteRateThrottle()]
        return super().get_throttles()

    # ------------------------------------------------------------------ #
    # Override mixin methods to add {data: ...} envelope                   #
    # ------------------------------------------------------------------ #

    def list(self, request: Request) -> Response:
        qs = self.filter_queryset(self.get_queryset())
        paginator = EnvelopePageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(UserListSerializer(page, many=True).data)

    def retrieve(self, request: Request, pk=None) -> Response:
        user = self.get_object()
        return Response({"data": UserDetailSerializer(user).data})

    def partial_update(self, request: Request, pk=None) -> Response:
        user = self.get_object()
        s = UserWriteSerializer(user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        log_action(
            actor=request.user,
            action="user.updated",
            target_type="User",
            target_id=user.id,
            metadata={"fields": list(request.data.keys())},
        )
        return Response({"data": UserDetailSerializer(user).data})

    def destroy(self, request: Request, pk=None) -> Response:
        user = self.get_object()
        if user == request.user:
            return Response(
                {
                    "errors": [
                        {
                            "code": "user.self_delete",
                            "detail": "Cannot delete your own account.",
                        }
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_id   = str(user.id)
        user_email = user.email
        user_role  = user.role
        user.delete()
        log_action(
            actor=request.user,
            action="user.deleted",
            target_type="User",
            target_id=user_id,
            metadata={"email": user_email, "role": user_role},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------ #
    # Custom actions                                                        #
    # ------------------------------------------------------------------ #

    @action(detail=False, methods=["get"], url_path="check-email", permission_classes=[IsAuthenticated, IsAdmin])
    def check_email(self, request: Request) -> Response:
        """GET /users/check-email?email=... — returns whether an email already exists (admin only)."""
        email = request.query_params.get("email", "").strip().lower()
        if not email:
            return Response({"data": {"exists": False}})
        exists = User.objects.filter(email=email).exists()
        return Response({"data": {"exists": exists}})

    @action(detail=False, methods=["get"], url_path="business-units")
    def business_units(self, request: Request) -> Response:
        """GET /users/business-units — distinct non-empty business unit values."""
        units = (
            User.objects.exclude(business_unit="")
            .values_list("business_unit", flat=True)
            .distinct()
            .order_by("business_unit")
        )
        return Response({"data": list(units)})

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request: Request) -> Response:
        """GET /users/stats — aggregate counts, always reflects full DB."""
        qs = User.objects.values("role", "is_active").annotate(n=Count("id"))
        totals: dict[str, int] = {"ADMIN": 0, "INSTRUCTOR": 0, "PARTICIPANT": 0, "GROUP_ADMIN": 0}
        active = blocked = 0
        for row in qs:
            totals[row["role"]] = totals.get(row["role"], 0) + row["n"]
            if row["is_active"]:
                active += row["n"]
            else:
                blocked += row["n"]
        return Response(
            {
                "data": {
                    "total": sum(totals.values()),
                    "admins": totals["ADMIN"],
                    "instructors": totals["INSTRUCTOR"],
                    "participants": totals["PARTICIPANT"],
                    "group_admins": totals["GROUP_ADMIN"],
                    "active": active,
                    "blocked": blocked,
                }
            }
        )

    @action(detail=False, methods=["post"], url_path="")
    def invite(self, request: Request) -> Response:
        """POST /users — invite single user."""
        s = InviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if User.objects.filter(email__iexact=d["email"]).exists():
            return Response(
                {
                    "errors": [
                        {
                            "code": "user.already_exists",
                            "message": "A user with this email already exists.",
                        }
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = invite_user(
            email=d["email"],
            full_name=d["full_name"],
            role=d["role"],
            invited_by=request.user,
        )
        log_action(
            actor=request.user,
            action="user.invite",
            target_type="User",
            target_id=user.id,
            metadata={"email": d["email"], "role": d["role"]},
        )
        return Response({"data": UserDetailSerializer(user).data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="bulk-invite")
    def bulk_invite(self, request: Request) -> Response:
        """POST /users/bulk-invite — invite up to 200 users at once."""
        s = BulkInviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        rows = s.validated_data["rows"]

        results = []
        for row in rows:
            if User.objects.filter(email__iexact=row["email"]).exists():
                results.append(
                    {"email": row["email"], "status": "skipped", "reason": "already_exists"}
                )
                continue
            invite_user(
                email=row["email"],
                full_name=row["full_name"],
                role=row["role"],
                invited_by=request.user,
            )
            results.append({"email": row["email"], "status": "invited"})

        invited_count = sum(1 for r in results if r["status"] == "invited")
        log_action(
            actor=request.user,
            action="user.bulk_invite",
            target_type="User",
            target_id="batch",
            metadata={"total": len(rows), "invited": invited_count},
        )
        return Response({"data": results}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="resend-invite")
    def resend_invite(self, request: Request, pk=None) -> Response:
        """POST /users/:id/resend-invite."""
        user = self.get_object()
        if user.has_usable_password():
            return Response(
                {
                    "errors": [
                        {
                            "code": "user.already_active",
                            "detail": "User has already set a password.",
                        }
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        invite_user(
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            invited_by=request.user,
            resend=True,
        )
        return Response({"data": {"detail": "Invite resent."}})


class InstructorListView(APIView):
    """GET /instructors — list all users with role INSTRUCTOR.

    Supports ?q= to filter by name or email (case-insensitive substring).
    Used by the Admin "assign instructors" picker in the group detail panel.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request: Request) -> Response:
        qs = User.objects.filter(role="INSTRUCTOR").order_by("full_name")
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q))
        return Response({"data": InstructorListSerializer(qs, many=True).data})


class UserVisibilityView(APIView):
    """PATCH /users/{pk}/visibility — update an instructor's can_view_all_classes tri-state.

    Accepts body: {"can_view_all_classes": null | true | false}
    null  → inherit system default (SystemSettings.instructors_can_view_all_classes)
    true  → always see all classes regardless of group assignment (read-only outside assigned)
    false → strict scoping (only assigned groups)

    Emits an audit entry with old/new values and scope="user".
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request: Request, pk: str | None = None) -> Response:
        target = get_object_or_404(User, pk=pk)
        if target.role != "INSTRUCTOR":
            return Response(
                {
                    "errors": [
                        {
                            "code": "user.not_instructor",
                            "message": "Visibility override can only be set for users with role INSTRUCTOR.",
                        }
                    ],
                    "data": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = UserVisibilityUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        old_value = target.can_view_all_classes
        new_value = ser.validated_data["can_view_all_classes"]
        target.can_view_all_classes = new_value
        target.save(update_fields=["can_view_all_classes"])
        log_action(
            actor=request.user,
            action=INSTRUCTOR_VISIBILITY_CHANGED,
            target_type="User",
            target_id=target.id,
            metadata={"scope": "user", "old": old_value, "new": new_value},
        )
        return Response({"data": {"can_view_all_classes": new_value}})
