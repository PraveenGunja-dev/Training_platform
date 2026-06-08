import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

vi.mock('@/lib/api-client', async () => {
  const axios = (await import('axios')).default;
  return { apiClient: axios.create({ baseURL: 'http://localhost:8000/api/v1' }) };
});

import { submissionsApi } from '../submissions';

const BASE_URL = 'http://localhost:8000/api/v1';
const SUBMISSION_ID = 'test-sub-uuid-1234';

const server = setupServer(
  http.get(`${BASE_URL}/assignments/submissions/${SUBMISSION_ID}/review`, () => {
    return HttpResponse.json({
      data: {
        id: 1,
        submission_id: SUBMISSION_ID,
        reviewer_id: 'rev-1',
        reviewer_name: 'Dr. Smith',
        comment: 'Excellent work.',
        grade_numeric: 9.0,
        grade_letter: '',
        reviewed_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    });
  }),
  http.get(`${BASE_URL}/assignments/submissions/no-review-id/review`, () => {
    return HttpResponse.json({ data: null });
  }),
  http.post(`${BASE_URL}/assignments/submissions/${SUBMISSION_ID}/review`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json(
      {
        data: {
          id: 2,
          submission_id: SUBMISSION_ID,
          reviewer_id: 'rev-1',
          reviewer_name: 'Dr. Smith',
          reviewed_at: '2026-06-01T11:00:00Z',
          updated_at: '2026-06-01T11:00:00Z',
          comment: body.comment ?? '',
          grade_numeric: body.grade_numeric ?? null,
          grade_letter: body.grade_letter ?? '',
        },
      },
      { status: 201 },
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('submissionsApi review methods', () => {
  it('getReview returns review data when review exists', async () => {
    const review = await submissionsApi.getReview(SUBMISSION_ID);
    expect(review).not.toBeNull();
    expect(review?.grade_numeric).toBe(9.0);
    expect(review?.reviewer_name).toBe('Dr. Smith');
  });

  it('getReview returns null when no review exists', async () => {
    const review = await submissionsApi.getReview('no-review-id');
    expect(review).toBeNull();
  });

  it('saveReview sends comment and grade_numeric', async () => {
    const review = await submissionsApi.saveReview(SUBMISSION_ID, {
      comment: 'Well done.',
      grade_numeric: 8.5,
    });
    expect(review.comment).toBe('Well done.');
    expect(review.grade_numeric).toBe(8.5);
  });

  it('saveReview sends letter grade', async () => {
    const review = await submissionsApi.saveReview(SUBMISSION_ID, {
      grade_letter: 'A',
    });
    expect(review.grade_letter).toBe('A');
  });

  it('saveReview with only comment (no grade) succeeds', async () => {
    const review = await submissionsApi.saveReview(SUBMISSION_ID, {
      comment: 'Needs more work.',
    });
    expect(review.comment).toBe('Needs more work.');
  });
});
