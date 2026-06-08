from rest_framework.views import exception_handler


def envelope_exception_handler(exc, context):
    """Wraps DRF errors as {errors: [{code, message, field?}], data: null}."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    errors = []
    data = response.data

    if isinstance(data, dict):
        for field, messages in data.items():
            if field == "detail":
                code = getattr(exc, "default_code", "error")
                errors.append({"code": code, "message": str(messages)})
            elif isinstance(messages, list):
                for msg in messages:
                    errors.append(
                        {
                            "code": getattr(msg, "code", "invalid") if hasattr(msg, "code") else "invalid",
                            "message": str(msg),
                            "field": field,
                        }
                    )
            else:
                errors.append({"code": "invalid", "message": str(messages), "field": field})
    elif isinstance(data, list):
        for msg in data:
            errors.append({"code": "error", "message": str(msg)})

    response.data = {"errors": errors, "data": None}
    return response
