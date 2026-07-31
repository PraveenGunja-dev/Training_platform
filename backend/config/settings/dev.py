from .base import *  # noqa: F401, F403

DEBUG = True
SUB_MENTOR_ROLE_ENABLED = True
JWT_REFRESH_COOKIE_SECURE = False
JWT_REFRESH_COOKIE_SAMESITE = "Lax"

# Run Celery tasks inline in dev (no worker needed)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Serve uploads locally when Azure Blob Storage is not configured
DEV_LOCAL_STORAGE = True

# No Django-level upload size limit in dev — matches base.py; no nginx in front of dev server
DATA_UPLOAD_MAX_MEMORY_SIZE = None
FILE_UPLOAD_MAX_MEMORY_SIZE = None

# No Redis needed for local dev
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
