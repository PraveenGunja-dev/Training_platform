import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import SubmissionsPage from '../SubmissionsPage';
import { submissionsApi } from '@/api/submissions';
import { assignmentsApi } from '@/api/assignments';
import type { Submission } from '@/lib/types';

vi.mock('@/api/submissions');
vi.mock('@/api/assignments');

const mockSub: Submission = {
  id: 'sub-1',
  task_id: 'task-1',
  user_id: 'u-1',
  version: 1,
  file_url: 'http://example.com/file.pdf',
  file_name: 'assignment.pdf',
  file_type: 'application/pdf',
  file_size: 2048,
  status: 'SUBMITTED',
  submitted_at: '2026-06-01T10:00:00Z',
  submitted_by: 'u-1',
  note: '',
  review: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SubmissionsPage />
    </QueryClientProvider>,
  );
}

describe('SubmissionsPage', () => {
  it('shows Grade column header in submissions table', async () => {
    vi.mocked(submissionsApi.mySubmissions).mockResolvedValue({ data: [mockSub] });
    vi.mocked(assignmentsApi.myTasks).mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('Grade')).toBeInTheDocument();
  });

  it('shows dash for submission without review', async () => {
    vi.mocked(submissionsApi.mySubmissions).mockResolvedValue({ data: [mockSub] });
    vi.mocked(assignmentsApi.myTasks).mockResolvedValue({ data: [] });
    renderPage();
    await screen.findByText('Grade');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows amber grade badge for numeric grade', async () => {
    const subWithReview: Submission = {
      ...mockSub,
      review: {
        id: 1,
        submission_id: 'sub-1',
        reviewer_id: 'r-1',
        reviewer_name: 'Admin',
        comment: '',
        grade_numeric: 9,
        grade_letter: '',
        reviewed_at: '2026-06-01T11:00:00Z',
        updated_at: '2026-06-01T11:00:00Z',
      },
    };
    vi.mocked(submissionsApi.mySubmissions).mockResolvedValue({ data: [subWithReview] });
    vi.mocked(assignmentsApi.myTasks).mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('9 / 10')).toBeInTheDocument();
  });

  it('shows Reviewed badge when review has no grade', async () => {
    const subWithReview: Submission = {
      ...mockSub,
      review: {
        id: 2,
        submission_id: 'sub-1',
        reviewer_id: 'r-1',
        reviewer_name: 'Admin',
        comment: 'Good work',
        grade_numeric: null,
        grade_letter: '',
        reviewed_at: '2026-06-01T11:00:00Z',
        updated_at: '2026-06-01T11:00:00Z',
      },
    };
    vi.mocked(submissionsApi.mySubmissions).mockResolvedValue({ data: [subWithReview] });
    vi.mocked(assignmentsApi.myTasks).mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('Reviewed')).toBeInTheDocument();
  });
});
