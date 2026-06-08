import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewDialog } from '../ReviewDialog';
import { submissionsApi } from '@/api/submissions';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/api/submissions');

const mockGetReview = vi.mocked(submissionsApi.getReview);
const mockSaveReview = vi.mocked(submissionsApi.saveReview);

function renderDialog(open = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewDialog
        open={open}
        onOpenChange={() => {}}
        submissionId="sub-123"
        participantName="Alice"
        taskTitle="Assignment 1"
      />
    </QueryClientProvider>,
  );
}

describe('ReviewDialog', () => {
  it('shows participant name and task title in dialog header', async () => {
    mockGetReview.mockResolvedValue(null);
    renderDialog();
    expect(await screen.findByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Assignment 1/)).toBeInTheDocument();
  });

  it('pre-fills existing review data', async () => {
    mockGetReview.mockResolvedValue({
      id: 1,
      submission_id: 'sub-123',
      reviewer_id: 'r1',
      reviewer_name: 'Admin',
      comment: 'Great work!',
      grade_numeric: 9,
      grade_letter: '',
      reviewed_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    });
    renderDialog();
    expect(await screen.findByDisplayValue('Great work!')).toBeInTheDocument();
  });

  it('shows numeric input when Numeric Score is selected', async () => {
    mockGetReview.mockResolvedValue(null);
    renderDialog();
    await screen.findByRole('combobox'); // wait for load
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'numeric' } });
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('calls saveReview with correct payload on save', async () => {
    mockGetReview.mockResolvedValue(null);
    mockSaveReview.mockResolvedValue({
      id: 2,
      submission_id: 'sub-123',
      reviewer_id: 'r1',
      reviewer_name: 'Admin',
      comment: 'Nice.',
      grade_numeric: null,
      grade_letter: '',
      reviewed_at: '2026-06-01T12:00:00Z',
      updated_at: '2026-06-01T12:00:00Z',
    });
    renderDialog();
    const textarea = await screen.findByPlaceholderText(/feedback/i);
    fireEvent.change(textarea, { target: { value: 'Nice.' } });
    fireEvent.click(screen.getByRole('button', { name: /save review/i }));
    await waitFor(() => {
      expect(mockSaveReview).toHaveBeenCalledWith(
        'sub-123',
        expect.objectContaining({ comment: 'Nice.' }),
      );
    });
  });

  it('Save button is disabled while saving', async () => {
    mockGetReview.mockResolvedValue(null);
    mockSaveReview.mockImplementation(() => new Promise(() => {})); // never resolves
    renderDialog();
    await screen.findByPlaceholderText(/feedback/i);
    fireEvent.click(screen.getByRole('button', { name: /save review/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save review/i })).toBeDisabled();
    });
  });
});
