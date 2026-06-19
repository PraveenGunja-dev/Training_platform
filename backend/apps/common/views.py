from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SchedulerHealth

_SCHEDULER_MAX_AGE_S = 90


@extend_schema(exclude=True)
class HealthzView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request: Request) -> Response:
        db_ok = _check_db() == "ok"
        http_status = 200 if db_ok else 503

        # Unauthenticated callers (load balancers, uptime monitors) get minimal response
        if not request.user or not request.user.is_authenticated:
            return Response({"status": "ok" if db_ok else "degraded"}, status=http_status)

        # Non-admin authenticated users also get the minimal response
        if getattr(request.user, "role", None) != "ADMIN":
            return Response({"status": "ok" if db_ok else "degraded"}, status=http_status)

        return Response(
            {
                "data": {
                    "db": _check_db(),
                    "redis": _check_redis(),
                    "scheduler": _check_scheduler(),
                    "version": "v0.1.0",
                }
            },
            status=http_status,
        )


def _check_db() -> str:
    try:
        connection.ensure_connection()
        return "ok"
    except Exception:
        return "down"


def _check_redis() -> str:
    try:
        cache.set("healthz_probe", "1", timeout=5)
        value = cache.get("healthz_probe")
        return "ok" if value == "1" else "degraded"
    except Exception:
        return "down"


def _check_scheduler() -> str:
    try:
        health = SchedulerHealth.objects.first()
        if health and health.last_heartbeat_at:
            age = (timezone.now() - health.last_heartbeat_at).total_seconds()
            return "ok" if age < _SCHEDULER_MAX_AGE_S else "degraded"
        return "degraded"
    except Exception:
        return "down"
