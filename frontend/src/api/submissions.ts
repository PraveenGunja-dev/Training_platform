import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, SaveReviewPayload, Submission, SubmissionReview, SubmissionWithUser } from '@/lib/types';

export const submissionsApi = {
  getUploadUrl: (taskId: string, body: { file_name: string; file_size: number; content_type: string }) =>
    apiClient
      .post<ApiEnvelope<{ upload_url: string; blob_name: string; expires_at: string }>>(
        `/assignments/${taskId}/upload-url`,
        body,
      )
      .then(r => r.data),

  submit: (
    taskId: string,
    body: FormData | { blob_name: string; file_name: string; file_size: number; content_type: string; note?: string },
  ) => {
    const payload =
      body instanceof FormData
        ? body
        : { file_url: body.blob_name, file_name: body.file_name, file_size: body.file_size, file_type: body.content_type, note: body.note };
    return apiClient.post<ApiEnvelope<Submission>>(`/assignments/${taskId}/submissions`, payload).then(r => r.data);
  },

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
