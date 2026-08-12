from datetime import timedelta

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken


def _dynamic_hours() -> int:
    """Return session_lifetime_hours from DB, or 0 on failure."""
    try:
        from apps.common.models import SystemSettings
        return SystemSettings.get_solo().session_lifetime_hours or 0
    except Exception:
        return 0


class DynamicAccessToken(AccessToken):
    FALLBACK_MINUTES = 30

    def __init__(self, *args, **kwargs):
        hours = _dynamic_hours()
        self.lifetime = timedelta(hours=hours) if hours > 0 else timedelta(minutes=self.FALLBACK_MINUTES)
        super().__init__(*args, **kwargs)


class DynamicRefreshToken(RefreshToken):
    """Refresh token whose lifetime is 2× the access-token lifetime (max 30 days)."""
    FALLBACK_DAYS = 7
    access_token_class = DynamicAccessToken

    def __init__(self, *args, **kwargs):
        hours = _dynamic_hours()
        if hours > 0:
            self.lifetime = timedelta(hours=min(hours * 2, 720))
        else:
            self.lifetime = timedelta(days=self.FALLBACK_DAYS)
        super().__init__(*args, **kwargs)


class DynamicTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        return DynamicRefreshToken.for_user(user)
