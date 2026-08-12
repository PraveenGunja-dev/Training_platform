from __future__ import annotations

import re


class FileValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message


def validate_file(file_name: str, file_size: int, content_type: str) -> None:
    """No-op. All file types and sizes are accepted."""
    return


_MAGIC_BYTES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"GIF8": "image/gif",
    b"RIFF": "image/webp",
}


class InvalidImageError(ValueError):
    pass


def validate_image_bytes(data: bytes) -> str:
    """
    Inspect actual file bytes to confirm an allowed image type.
    Returns the canonical MIME type. Raises InvalidImageError otherwise.
    """
    if len(data) < 12:
        raise InvalidImageError("File is too small to be a valid image.")

    for magic, mime in _MAGIC_BYTES.items():
        if data[: len(magic)] == magic:
            if mime == "image/webp" and data[8:12] != b"WEBP":
                raise InvalidImageError("File is not a valid image.")
            return mime

    raise InvalidImageError(
        "File type not allowed. Only JPEG, PNG, GIF, and WebP images are accepted."
    )


def _safe_filename(name: str) -> str:
    """Strip control characters (including CR/LF) that would allow header injection."""
    return re.sub(r'[\x00-\x1f\x7f"\\]', '_', name)


_SAFE_INLINE_MIME_TYPES = frozenset({
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
})


def safe_content_type(stored_type: str) -> str:
    """Return stored_type if safe to serve inline; otherwise return octet-stream.
    Prevents browsers from rendering active-content types (SVG, HTML, JS).
    """
    if stored_type and stored_type.split(";")[0].strip().lower() in _SAFE_INLINE_MIME_TYPES:
        return stored_type
    return "application/octet-stream"
