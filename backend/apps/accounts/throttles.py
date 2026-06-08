from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class RefreshTokenThrottle(AnonRateThrottle):
    """Throttle the JWT refresh endpoint to mitigate token-farming attacks.

    Uses AnonRateThrottle (IP-based) because the request arrives unauthenticated
    — the user identity is only known after the cookie is verified.
    """
    scope = "refresh_token"
    THROTTLE_RATES = {"refresh_token": "30/minute"}


class ChangePasswordThrottle(UserRateThrottle):
    """Throttle the change-password endpoint per authenticated user."""
    scope = "change_password"
    THROTTLE_RATES = {"change_password": "20/hour"}
