from __future__ import annotations


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
