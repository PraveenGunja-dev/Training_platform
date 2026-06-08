from urllib.parse import parse_qs, urlparse

from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response


class EnvelopePageNumberPagination(PageNumberPagination):
    """Page-number paginator that wraps results in {data: [], meta: {…}}."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200
    page_query_param = "page"

    def get_paginated_response(self, data):  # type: ignore[override]
        return Response(
            {
                "data": data,
                "meta": {
                    "page": self.page.number,
                    "page_size": self.get_page_size(self.request),
                    "total": self.page.paginator.count,
                },
            }
        )


def _cursor_token_from_link(link: str | None) -> str | None:
    if link is None:
        return None
    tokens = parse_qs(urlparse(link).query).get("cursor", [])
    return tokens[0] if tokens else None


class AuditCursorPagination(CursorPagination):
    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 100
    ordering = "-created_at"
    cursor_query_param = "cursor"

    def get_paginated_response(self, data):  # type: ignore[override]
        return Response(
            {
                "data": data,
                "meta": {
                    "next_cursor": _cursor_token_from_link(self.get_next_link()),
                    "previous_cursor": _cursor_token_from_link(self.get_previous_link()),
                },
            }
        )

    def get_paginated_response_schema(self, schema):  # type: ignore[override]
        return {
            "type": "object",
            "required": ["data", "meta"],
            "properties": {
                "data": schema,
                "meta": {
                    "type": "object",
                    "properties": {
                        "next_cursor": {"type": "string", "nullable": True},
                        "previous_cursor": {"type": "string", "nullable": True},
                    },
                },
            },
        }
