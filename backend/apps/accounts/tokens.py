from datetime import timedelta

from rest_framework_simplejwt.tokens import AccessToken


class DynamicAccessToken(AccessToken):
    FALLBACK_MINUTES = 30

    def __init__(self, *args, **kwargs):
        from apps.common.models import SystemSettings
        try:
            settings_obj = SystemSettings.get_solo()
            hours = settings_obj.session_lifetime_hours or 0
            if hours > 0:
                self.lifetime = timedelta(hours=hours)
            else:
                self.lifetime = timedelta(minutes=self.FALLBACK_MINUTES)
        except Exception:
            self.lifetime = timedelta(minutes=self.FALLBACK_MINUTES)
        super().__init__(*args, **kwargs)
