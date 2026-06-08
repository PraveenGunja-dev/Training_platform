from __future__ import annotations

from typing import Final

# Size caps per category (bytes)
DOC_MAX_BYTES: Final[int] = 25 * 1024 * 1024    # 25 MB
IMAGE_MAX_BYTES: Final[int] = 10 * 1024 * 1024  # 10 MB
VIDEO_MAX_BYTES: Final[int] = 500 * 1024 * 1024 # 500 MB

ALLOWED_DOC_TYPES: Final[frozenset[str]] = frozenset(
    [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
    ]
)

ALLOWED_IMAGE_TYPES: Final[frozenset[str]] = frozenset(
    [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
    ]
)

ALLOWED_VIDEO_TYPES: Final[frozenset[str]] = frozenset(
    [
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
    ]
)

ALL_ALLOWED_TYPES: Final[frozenset[str]] = ALLOWED_DOC_TYPES | ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES


class FileValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message


def validate_file(file_name: str, file_size: int, content_type: str) -> None:
    """Validate file type and size. Raises FileValidationError on failure."""
    if content_type in ALLOWED_IMAGE_TYPES:
        if file_size > IMAGE_MAX_BYTES:
            raise FileValidationError(
                "file.too_large",
                f"Image files must not exceed 10 MB. Received {file_size / 1024 / 1024:.1f} MB.",
            )
    elif content_type in ALLOWED_VIDEO_TYPES:
        if file_size > VIDEO_MAX_BYTES:
            raise FileValidationError(
                "file.too_large",
                f"Video files must not exceed 500 MB. Received {file_size / 1024 / 1024:.1f} MB.",
            )
    elif content_type in ALLOWED_DOC_TYPES:
        if file_size > DOC_MAX_BYTES:
            raise FileValidationError(
                "file.too_large",
                f"Document files must not exceed 25 MB. Received {file_size / 1024 / 1024:.1f} MB.",
            )
    else:
        raise FileValidationError(
            "file.type_not_allowed",
            f"Content type '{content_type}' is not allowed.",
        )
