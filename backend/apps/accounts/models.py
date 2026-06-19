import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("ADMIN", "Admin"),
        ("INSTRUCTOR", "Instructor"),
        ("PARTICIPANT", "Participant"),
        ("GROUP_ADMIN", "Group Admin"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="PARTICIPANT")
    photo_url = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # tri-state: None = inherit system default, True/False = explicit override
    can_view_all_classes = models.BooleanField(null=True, blank=True, default=None)
    business_unit = models.CharField(max_length=255, blank=True, default="")
    grade_code = models.CharField(max_length=100, blank=True, default="")
    department = models.CharField(max_length=255, blank=True, default="")
    employee_code = models.CharField(max_length=50, blank=True, default="")
    must_change_password = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} <{self.email}>"


class PasswordSetupToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="setup_tokens")
    token_hash = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_password_setup_token"
        indexes = [
            models.Index(fields=["expires_at"], name="pst_expires_idx"),
        ]

    def __str__(self) -> str:
        return f"SetupToken({self.user.email})"
