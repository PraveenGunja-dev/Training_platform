import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeedbackCard } from '../FeedbackCard';
import type { SubmissionReview } from '@/lib/types';

const baseReview: SubmissionReview = {
  id: 1,
  submission_id: 'sub-1',
  reviewer_id: 'r-1',
  reviewer_name: 'Dr. Smith',
  comment: '',
  grade_numeric: null,
  grade_letter: '',
  reviewed_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

describe('FeedbackCard', () => {
  it('shows reviewer name', () => {
    render(<FeedbackCard review={baseReview} />);
    expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
  });

  it('shows numeric grade when set', () => {
    render(<FeedbackCard review={{ ...baseReview, grade_numeric: 8.5 }} />);
    expect(screen.getByText('8.5 / 10')).toBeInTheDocument();
  });

  it('shows letter grade when set', () => {
    render(<FeedbackCard review={{ ...baseReview, grade_letter: 'A+' }} />);
    expect(screen.getByText('A+')).toBeInTheDocument();
  });

  it('shows comment text when present', () => {
    render(<FeedbackCard review={{ ...baseReview, comment: 'Great effort!' }} />);
    expect(screen.getByText('Great effort!')).toBeInTheDocument();
  });

  it('shows fallback message when review has no grade and no comment', () => {
    render(<FeedbackCard review={baseReview} />);
    expect(screen.getByText(/no comments added/i)).toBeInTheDocument();
  });

  it('does not show Grade section when no grade is given', () => {
    render(<FeedbackCard review={{ ...baseReview, comment: 'Nice work.' }} />);
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
  });
});
