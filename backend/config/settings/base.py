from datetime import timedelta
from pathlib import Path

import environ
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

AUTH_USER_MODEL = "accounts.User"

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "django_celery_beat",
    "django_filters",
]

LOCAL_APPS = [
    "apps.common",
    "apps.audit",
    "apps.accounts",
    "apps.groups",
    "apps.scheduling",
    "apps.attendance",
    "apps.assignments",
    "apps.documents",
    "apps.notifications",
    "apps.analytics",
    "apps.users",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates", BASE_DIR.parent / "frontend" / "dist"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://ems_user:ems_pass@localhost:5432/ems_db"),
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Redis cache (django-redis)
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "ems",
    }
}

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.envelope_exception_handler",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/minute",
        "refresh_token": "30/minute",
        "change_password": "20/hour",
        "invite": "30/hour",
    },
}

# SimpleJWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

JWT_REFRESH_COOKIE_NAME = "refresh_token"
JWT_REFRESH_COOKIE_PATH = "/api/v1/auth/refresh"
JWT_REFRESH_COOKIE_SAMESITE = "Lax"
JWT_REFRESH_COOKIE_HTTPONLY = True
JWT_REFRESH_COOKIE_SECURE = False  # flipped to True in production

# CORS
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://localhost:5174"],
)
CORS_ALLOW_CREDENTIALS = True

# Email
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    default="Employee Management System <noreply@ems.local>",
)
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

# Azure Blob Storage (B-06: SAS upload for assignments/submissions)
AZURE_ACCOUNT_NAME = env("AZURE_ACCOUNT_NAME", default="")
AZURE_ACCOUNT_KEY = env("AZURE_ACCOUNT_KEY", default="")
AZURE_CONTAINER = env("AZURE_CONTAINER", default="")

# drf-spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "Employee Management System API",
    "DESCRIPTION": "REST API for the Employee Management System",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Celery
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
# Feature flag — kept False until Chunk 9 integration flip
INSTRUCTOR_ROLE_ENABLED = False

CELERY_BEAT_SCHEDULE = {
    "heartbeat": {
        "task": "apps.common.tasks.heartbeat",
        "schedule": 60.0,
    },
    "open-due-tasks": {
        "task": "apps.assignments.tasks.open_due_tasks",
        "schedule": 60.0,
    },
    "send-deadline-reminders": {
        "task": "apps.notifications.tasks.send_deadline_reminders",
        "schedule": 60.0,
    },
    "send-class-start-reminders": {
        "task": "apps.scheduling.tasks.send_class_start_reminders",
        "schedule": 60.0,
    },
    "send-attendance-session-reminders": {
        "task": "apps.notifications.tasks.send_attendance_session_reminders",
        "schedule": 60.0,
    },
    "aggregate-daily": {
        "task": "apps.analytics.tasks.aggregate_daily",
        "schedule": crontab(hour=2, minute=0),
    },
}
