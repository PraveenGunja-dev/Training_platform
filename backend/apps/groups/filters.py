from django.db.models import QuerySet


def apply_group_filters(queryset: QuerySet, query_params: dict) -> QuerySet:
    include_archived = str(query_params.get("include_archived", "")).lower() in ("1", "true")
    if not include_archived:
        queryset = queryset.filter(is_archived=False)
    return queryset
