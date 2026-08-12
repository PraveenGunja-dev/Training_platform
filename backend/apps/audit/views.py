import csv
import json
from django.http import StreamingHttpResponse
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.common.pagination import AuditCursorPagination
from apps.common.permissions import IsAdmin

from .models import AuditLog
from .serializers import AuditLogSerializer


def _apply_audit_filters(qs, request):
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
    return qs


@extend_schema(exclude=True)
class AuditLogListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request: Request):
        qs = AuditLog.objects.select_related("actor").all()
        qs = _apply_audit_filters(qs, request)
        paginator = AuditCursorPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AuditLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class _EchoBuffer:
    """Minimal write-only object that returns what is written to it.
    Required by StreamingHttpResponse — csv.writer calls .write() and
    StreamingHttpResponse iterates over the generator's yielded strings.
    """
    def write(self, value: str) -> str:
        return value


@extend_schema(exclude=True)
class AuditLogExportView(APIView):
    """GET /api/v1/audit/export — stream all matching audit rows as CSV.

    Accepts the same filter params as AuditLogListView:
      actor_id, action, target_type, from, to

    Returns a CSV file (no pagination limit) with headers:
      Timestamp, Actor, Actor Email, Action, Target Type, Target ID, Metadata
    """

    permission_classes = [IsAdmin]

    def get(self, request: Request) -> StreamingHttpResponse:
        qs = AuditLog.objects.select_related("actor").order_by("-created_at")
        qs = _apply_audit_filters(qs, request)

        def rows():
            buffer = _EchoBuffer()
            writer = csv.writer(buffer)
            yield writer.writerow(
                ["Timestamp", "Actor", "Actor Email", "Action", "Target Type", "Target ID", "Metadata"]
            )
            for entry in qs.iterator(chunk_size=500):
                actor_name = ""
                actor_email = ""
                if entry.actor:
                    actor_name = entry.actor.full_name or ""
                    actor_email = entry.actor.email or ""
                yield writer.writerow([
                    entry.created_at.isoformat(),
                    actor_name,
                    actor_email,
                    entry.action,
                    entry.target_type,
                    entry.target_id or "",
                    json.dumps(entry.metadata) if entry.metadata else "",
                ])

        response = StreamingHttpResponse(rows(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="audit_log.csv"'
        return response
