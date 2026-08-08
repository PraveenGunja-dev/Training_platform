from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class ClassFeedback(models.Model):
    """One feedback entry per participant per completed class session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class_session = models.ForeignKey(
        "scheduling.Class",
        on_delete=models.CASCADE,
        related_name="feedbacks",
    )
    participant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedbacks_given",
    )

    # Half-star increments: 1.0, 1.5, 2.0, … 5.0
    # max_digits=2, decimal_places=1 stores values like 4.5 correctly.
    rating = models.DecimalField(max_digits=2, decimal_places=1)

    comment = models.TextField(blank=True, default="")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["class_session", "participant"],
                name="uniq_feedback_session_participant",
            )
        ]
        indexes = [
            models.Index(
                fields=["class_session", "submitted_at"],
                name="fb_session_submitted_idx",
            ),
            models.Index(
                fields=["participant", "submitted_at"],
                name="fb_participant_submitted_idx",
            ),
        ]
        ordering = ["-submitted_at"]

    def __str__(self) -> str:
        return f"Feedback({self.participant_id} → {self.class_session_id}, {self.rating}★)"
