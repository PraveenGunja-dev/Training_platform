import django_filters
from django.db import models

from apps.accounts.models import User


class UserFilter(django_filters.FilterSet):
    role = django_filters.ChoiceFilter(choices=User.ROLE_CHOICES)
    status = django_filters.CharFilter(method="filter_status")
    search = django_filters.CharFilter(method="filter_search")
    business_unit = django_filters.CharFilter(field_name="business_unit", lookup_expr="iexact")

    def filter_status(self, qs, name: str, value: str):  # type: ignore[override]
        if value == "active":
            return qs.filter(is_active=True)
        if value == "deactivated":
            return qs.filter(is_active=False)
        return qs

    def filter_search(self, qs, name: str, value: str):  # type: ignore[override]
        return qs.filter(
            models.Q(email__icontains=value)
            | models.Q(full_name__icontains=value)
            | models.Q(employee_code__icontains=value)
        )

    class Meta:
        model = User
        fields = ["role", "status"]
