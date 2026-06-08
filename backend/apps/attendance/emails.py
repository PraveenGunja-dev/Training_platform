from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string


def send_session_started_email(*, class_obj, recipient_emails: list[str]) -> None:
    if not recipient_emails:
        return
    subject = f"Attendance is now open for {class_obj.title}"
    body = render_to_string(
        "attendance/session_started.txt",
        {
            "class_title": class_obj.title,
            "started_at": class_obj.starts_at.strftime("%d %b %Y, %I:%M %p UTC"),
            "frontend_url": settings.FRONTEND_URL,
        },
    )
    # BCC keeps recipient list private; to= is set to the from address to produce a valid email.
    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.DEFAULT_FROM_EMAIL],
        bcc=recipient_emails,
    )
    email.send(fail_silently=False)
