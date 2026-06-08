import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, AssignmentTask, LatePolicy } from '@/lib/types';

export const assignmentsApi = {
  list: (params?: { group_id?: string; state?: string; late_policy?: string }) =>
    apiClient.get<ApiEnvelope<AssignmentTask[]>>('/assignments', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<AssignmentTask>>(`/assignments/${id}`).then(r => r.data),
  getQuestionUploadUrl: (filename: string, content_type: string) =>
    apiClient.post<ApiEnvelope<{ upload_url: string; blob_name: string }>>(
      '/assignments/question-upload-url', { filename, content_type }
    ).then(r => r.data),
  getQuestionDownloadUrl: (id: string) =>
    apiClient.get<ApiEnvelope<{ download_url: string }>>(`/assignments/${id}/question-download`).then(r => r.data),
  create: (body: {
    group_id: string; class_id?: string; title: string; question: string;
    description?: string; instructions?: string; upload_open_at: string;
    deadline_at: string; late_policy: LatePolicy; reminder_offsets?: number[];
    question_file_url?: string; question_file_name?: string;
    question_file_type?: string; question_file_size?: number;
  }) => apiClient.post<ApiEnvelope<AssignmentTask>>('/assignments', body).then(r => r.data),
  update: (id: string, body: Partial<AssignmentTask>) =>
    apiClient.patch<ApiEnvelope<AssignmentTask>>(`/assignments/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/assignments/${id}`),
  close: (id: string) => apiClient.post(`/assignments/${id}/close`).then(r => r.data),
  myTasks: (params?: { state?: string }) =>
    apiClient.get<ApiEnvelope<AssignmentTask[]>>('/me/tasks', { params }).then(r => r.data),
  listByClass: (classId: string) =>
    apiClient.get<ApiEnvelope<AssignmentTask[]>>('/assignments', { params: { class_id: classId } }).then(r => r.data),
};
