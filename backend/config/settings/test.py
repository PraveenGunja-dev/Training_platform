from .base import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# DummyCache means every throttle check sees an empty cache, effectively
# disabling rate-limiting in the test suite without touching view code.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# B-08: run tasks synchronously in tests — no broker needed
CELERY_TASK_ALWAYS_EAGER = True
