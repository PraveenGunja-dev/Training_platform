class ContentSecurityPolicyMiddleware:
    """Emit a Content-Security-Policy header on every response."""
    def __init__(self, get_response):
        self.get_response = get_response
        from django.conf import settings
        self._csp = getattr(settings, "CSP_HEADER", "default-src 'self'")

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self._csp)
        return response
