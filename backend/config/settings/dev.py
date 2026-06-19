from .base import *  # noqa: F401, F403

DEBUG = True
INSTRUCTOR_ROLE_ENABLED = True
JWT_REFRESH_COOKIE_SECURE = False
JWT_REFRESH_COOKIE_SAMESITE = "Lax"

# Run Celery tasks inline in dev (no worker needed)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Serve uploads locally when Azure Blob Storage is not configured
DEV_LOCAL_STORAGE = True

# Allow large file uploads in dev (no Azure, so files go through Django directly)
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB

# No Redis needed for local dev
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
