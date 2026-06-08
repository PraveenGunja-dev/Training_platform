from __future__ import annotations

import datetime
import os

from django.conf import settings


def _azure_config() -> tuple[str, str, str]:
    """Return (account_name, account_key, container). All empty strings if not configured."""
    account_name = getattr(settings, "AZURE_ACCOUNT_NAME", "") or os.environ.get("AZURE_ACCOUNT_NAME", "")
    account_key = getattr(settings, "AZURE_ACCOUNT_KEY", "") or os.environ.get("AZURE_ACCOUNT_KEY", "")
    container = getattr(settings, "AZURE_CONTAINER", "") or os.environ.get("AZURE_CONTAINER", "")
    return account_name, account_key, container


def generate_upload_sas(blob_name: str, content_type: str) -> str:
    """
    Issue a 15-min SAS PUT URL for direct-to-Blob upload.
    Falls back to mock://upload/<blob_name> when Azure vars are not set (dev mode).
    Video uploads MUST use this endpoint — they never traverse Gunicorn.
    """
    account_name, account_key, container = _azure_config()

    if not all([account_name, account_key, container]):
        if getattr(settings, "DEV_LOCAL_STORAGE", False):
            return f"http://localhost:8000/api/v1/dev/upload/{blob_name}"
        return f"mock://upload/{blob_name}"

    try:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas  # type: ignore[import]

        expiry = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expiry,
            content_type=content_type,
        )
        return f"https://{account_name}.blob.core.windows.net/{container}/{blob_name}?{sas_token}"
    except ImportError:
        if getattr(settings, "DEV_LOCAL_STORAGE", False):
            return f"http://localhost:8000/api/v1/dev/upload/{blob_name}"
        return f"mock://upload/{blob_name}"


def generate_download_sas(blob_name: str) -> str:
    """Generate a 15-min SAS GET URL. Falls back to mock://download/<blob_name> in dev."""
    account_name, account_key, container = _azure_config()

    if not all([account_name, account_key, container]):
        if getattr(settings, "DEV_LOCAL_STORAGE", False):
            return f"http://localhost:8000/api/v1/dev/download/{blob_name}"
        return f"mock://download/{blob_name}"

    try:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas  # type: ignore[import]

        expiry = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=expiry,
        )
        return f"https://{account_name}.blob.core.windows.net/{container}/{blob_name}?{sas_token}"
    except ImportError:
        if getattr(settings, "DEV_LOCAL_STORAGE", False):
            return f"http://localhost:8000/api/v1/dev/download/{blob_name}"
        return f"mock://download/{blob_name}"
