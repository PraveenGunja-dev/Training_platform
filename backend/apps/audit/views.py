from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.common.pagination import AuditCursorPagination
from apps.common.permissions import IsAdmin

from .models import AuditLog
from .serializers import AuditLogSerializer


@extend_schema(exclude=True)
class AuditLogListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request: Request):
        qs = AuditLog.objects.select_related("actor").all()

        actor_id = request.query_params.get("actor_id")
        if actor_id:
            qs = qs.filter(actor_id=actor_id)

        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)

        target_type = request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)

        from_dt = request.query_params.get("from")
        if from_dt:
            parsed = parse_datetime(from_dt)
            if parsed:
                qs = qs.filter(created_at__gte=parsed)

        to_dt = request.query_params.get("to")
        if to_dt:
            parsed = parse_datetime(to_dt)
            if parsed:
                qs = qs.filter(created_at__lte=parsed)

        paginator = AuditCursorPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AuditLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
