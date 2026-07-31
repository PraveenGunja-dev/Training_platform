from __future__ import annotations


class FileValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message


def validate_file(file_name: str, file_size: int, content_type: str) -> None:
    """No-op. All file types and sizes are accepted."""
    return
