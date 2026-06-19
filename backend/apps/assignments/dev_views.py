from __future__ import annotations

import os

from django.conf import settings
from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

_DEV_MEDIA_ROOT = os.path.realpath(os.path.join(settings.BASE_DIR, "dev_media"))


@extend_schema(exclude=True)
class DevUploadView(APIView):
    # No auth required — mirrors Azure SAS URL behaviour (signature is in the URL).
    # This endpoint is only registered when DEBUG=True (see assignments/urls.py).
    permission_classes = [AllowAny]
    authentication_classes = []

    def put(self, request, blob_name: str):
        if not settings.DEBUG:
            return Response(status=403)
        dest = os.path.realpath(os.path.join(_DEV_MEDIA_ROOT, blob_name))
        if os.path.commonpath([dest, _DEV_MEDIA_ROOT]) != _DEV_MEDIA_ROOT:
            raise Http404
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        # Stream directly from WSGI input to avoid DATA_UPLOAD_MAX_MEMORY_SIZE limit
        wsgi_input = request.META.get("wsgi.input")
        with open(dest, "wb") as f:
            if wsgi_input:
                while True:
                    chunk = wsgi_input.read(65536)  # 64 KB chunks
                    if not chunk:
                        break
                    f.write(chunk)
            else:
                f.write(request.body)
        return Response(status=200)


@extend_schema(exclude=True)
class DevDownloadView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, blob_name: str):
        if not settings.DEBUG:
            return Response(status=403)
        path = os.path.realpath(os.path.join(_DEV_MEDIA_ROOT, blob_name))
        if os.path.commonpath([path, _DEV_MEDIA_ROOT]) != _DEV_MEDIA_ROOT:
            raise Http404
        if not os.path.exists(path):
            raise Http404
        return FileResponse(open(path, "rb"))
