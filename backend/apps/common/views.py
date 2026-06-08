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
        db_status = _check_db()
        redis_status = _check_redis()
        scheduler_status = _check_scheduler()

        http_status = 200 if db_status == "ok" else 503
        return Response(
            {
                "data": {
                    "db": db_status,
                    "redis": redis_status,
                    "scheduler": scheduler_status,
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
