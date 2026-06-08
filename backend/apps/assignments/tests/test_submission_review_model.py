import pytest
from django.core.exceptions import ValidationError

from apps.assignments.models import SubmissionReview


@pytest.mark.django_db
class TestSubmissionReviewModel:

    def test_review_created_with_comment_only(self, submission_factory):
        sub = submission_factory()
        review = SubmissionReview.objects.create(
            submission=sub,
            comment="Good work",
        )
        assert review.comment == "Good work"
        assert review.grade_numeric is None
        assert review.grade_letter == ""

    def test_review_created_with_numeric_grade(self, submission_factory):
        sub = submission_factory()
        review = SubmissionReview.objects.create(
            submission=sub,
            grade_numeric=8.5,
        )
        assert review.grade_numeric == pytest.approx(8.5)

    def test_review_created_with_letter_grade(self, submission_factory):
        sub = submission_factory()
        review = SubmissionReview.objects.create(
            submission=sub,
            grade_letter="A",
        )
        assert review.grade_letter == "A"

    def test_both_grades_raises_validation_error(self, submission_factory):
        sub = submission_factory()
        review = SubmissionReview(
            submission=sub,
            grade_numeric=9.0,
            grade_letter="A",
        )
        with pytest.raises(ValidationError):
            review.clean()

    def test_one_submission_one_review(self, submission_factory):
        sub = submission_factory()
        SubmissionReview.objects.create(submission=sub, comment="First")
        with pytest.raises(Exception):
            SubmissionReview.objects.create(submission=sub, comment="Second")
