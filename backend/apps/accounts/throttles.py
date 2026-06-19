from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """5 login attempts per minute per IP to mitigate brute-force attacks.
    Effective rate: see DEFAULT_THROTTLE_RATES['login'] in settings.
    """
    scope = "login"


class RefreshTokenThrottle(AnonRateThrottle):
    """Effective rate: see DEFAULT_THROTTLE_RATES['refresh_token'] in settings."""
    scope = "refresh_token"


class ChangePasswordThrottle(UserRateThrottle):
    """Effective rate: see DEFAULT_THROTTLE_RATES['change_password'] in settings."""
    scope = "change_password"


class InviteRateThrottle(UserRateThrottle):
    """Limit invite endpoint to 30 invitations per hour per admin user.
    Effective rate: see DEFAULT_THROTTLE_RATES['invite'] in settings.
    """
    scope = "invite"
