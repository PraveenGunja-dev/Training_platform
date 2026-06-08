from __future__ import annotations

from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from .models import Notification, NotificationPreference
from .serializers import NotificationPreferenceSerializer, NotificationSerializer


class NotificationViewSet(ViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def list(self, request: Request) -> Response:
        qs = Notification.objects.filter(user=request.user).order_by("-created_at")
        if request.query_params.get("unread_only") == "true":
            qs = qs.filter(read_at__isnull=True)
        # Cursor pagination: use created_at timestamp as cursor
        cursor = request.query_params.get("cursor")
        if cursor:
            qs = qs.filter(created_at__lt=cursor)
        try:
            limit = min(int(request.query_params.get("limit", 20)), 100)
        except (ValueError, TypeError):
            limit = 20
        items = list(qs[:limit])
        data = NotificationSerializer(items, many=True).data
        next_cursor = items[-1].created_at.isoformat() if len(items) == limit else None
        return Response({
            "data": data,
            "meta": {"next_cursor": next_cursor},
        })

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request: Request) -> Response:
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"data": {"unread_count": count}})

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request: Request, pk=None) -> Response:
        Notification.objects.filter(id=pk, user=request.user, read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response(status=204)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request: Request) -> Response:
        Notification.objects.filter(user=request.user, read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response(status=204)


class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        prefs, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response({"data": NotificationPreferenceSerializer(prefs).data})

    def patch(self, request: Request) -> Response:
        prefs, _ = NotificationPreference.objects.get_or_create(user=request.user)
        ser = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"data": NotificationPreferenceSerializer(prefs).data})
