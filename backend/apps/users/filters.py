import django_filters
from django.db import models

from apps.accounts.models import User


class UserFilter(django_filters.FilterSet):
    role = django_filters.ChoiceFilter(choices=User.ROLE_CHOICES)
    status = django_filters.CharFilter(method="filter_status")
    setup = django_filters.CharFilter(method="filter_setup")
    search = django_filters.CharFilter(method="filter_search")
    business_unit = django_filters.CharFilter(field_name="business_unit", lookup_expr="iexact")
    group_admin = django_filters.BooleanFilter(method="filter_group_admin")

    def filter_status(self, qs, name: str, value: str):  # type: ignore[override]
        if value in ("active", "allowed"):
            return qs.filter(is_active=True)
        if value in ("deactivated", "blocked"):
            return qs.filter(is_active=False)
        return qs

    def filter_setup(self, qs, name: str, value: str):  # type: ignore[override]
        if value == "pending":
            return qs.filter(must_change_password=True)
        if value == "complete":
            return qs.filter(must_change_password=False)
        return qs

    def filter_search(self, qs, name: str, value: str):  # type: ignore[override]
        return qs.filter(
            models.Q(email__icontains=value)
            | models.Q(full_name__icontains=value)
            | models.Q(employee_code__icontains=value)
        )

    def filter_group_admin(self, qs, name: str, value: bool):  # type: ignore[override]
        from apps.groups.models import GroupAdmin
        if value:
            admin_ids = GroupAdmin.objects.values_list("admin_id", flat=True)
            return qs.filter(id__in=admin_ids)
        return qs

    class Meta:
        model = User
        fields = ["role", "status", "setup", "group_admin"]
