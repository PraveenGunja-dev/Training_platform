from __future__ import annotations

import os

from django.conf import settings
from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

_DEV_MEDIA_ROOT = os.path.realpath(os.path.join(settings.BASE_DIR, "dev_media"))


@extend_schema(exclude=True)
class DevUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, blob_name: str):
        if not settings.DEBUG:
            return Response(status=403)
        dest = os.path.realpath(os.path.join(_DEV_MEDIA_ROOT, blob_name))
        if os.path.commonpath([dest, _DEV_MEDIA_ROOT]) != _DEV_MEDIA_ROOT:
            raise Http404
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(request.body)
        return Response(status=200)


@extend_schema(exclude=True)
class DevDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, blob_name: str):
        if not settings.DEBUG:
            return Response(status=403)
        path = os.path.realpath(os.path.join(_DEV_MEDIA_ROOT, blob_name))
        if os.path.commonpath([path, _DEV_MEDIA_ROOT]) != _DEV_MEDIA_ROOT:
            raise Http404
        if not os.path.exists(path):
            raise Http404
        return FileResponse(open(path, "rb"))
