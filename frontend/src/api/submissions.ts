import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, SaveReviewPayload, Submission, SubmissionReview, SubmissionWithUser } from '@/lib/types';

export const submissionsApi = {
  listForTask: (taskId: string, params?: { status?: string; search?: string; cursor?: string }) =>
    apiClient.get<ApiEnvelope<SubmissionWithUser[]>>(`/assignments/${taskId}/submissions`, { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<ApiEnvelope<Submission>>(`/submissions/${id}`).then(r => r.data),

  mySubmissions: (params?: { task_id?: string; sort?: string }) =>
    apiClient.get<ApiEnvelope<Submission[]>>('/me/submissions', { params }).then(r => r.data),

  async getReview(submissionId: string): Promise<SubmissionReview | null> {
    const res = await apiClient.get<ApiEnvelope<SubmissionReview | null>>(
      `/assignments/submissions/${submissionId}/review`,
    );
    return res.data.data;
  },

  async saveReview(submissionId: string, payload: SaveReviewPayload): Promise<SubmissionReview> {
    const res = await apiClient.post<ApiEnvelope<SubmissionReview>>(
      `/assignments/submissions/${submissionId}/review`,
      payload,
    );
    return res.data.data;
  },
};
