import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, AssignmentTask, LatePolicy, Submission } from '@/lib/types';

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export const assignmentsApi = {
  list: (params?: { group_id?: string; state?: string; late_policy?: string }) =>
    apiClient.get<ApiEnvelope<AssignmentTask[]>>('/assignments', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<AssignmentTask>>(`/assignments/${id}`).then(r => r.data),
  // Create assignment (JSON, no file fields)
  create: (body: {
    group_id: string; class_id?: string; title: string; question: string;
    description?: string; instructions?: string; upload_open_at: string;
    deadline_at: string; late_policy: LatePolicy; reminder_offsets?: number[];
    sub_group_id?: string | null; is_open?: boolean;
  }) => apiClient.post<ApiEnvelope<AssignmentTask>>('/assignments', body).then(r => r.data),
  // Upload/replace question file (separate step after create)
  uploadQuestionFile: (taskId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post<ApiEnvelope<AssignmentTask>>(
      `/assignments/${taskId}/question-file`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data);
  },
  // Download question file
  downloadQuestionFile: async (taskId: string, filename: string): Promise<void> => {
    const response = await apiClient.get(`/assignments/${taskId}/question-file`, { responseType: 'blob' });
    triggerDownload(response.data as Blob, filename);
  },
  update: (id: string, body: Partial<AssignmentTask>) =>
    apiClient.patch<ApiEnvelope<AssignmentTask>>(`/assignments/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/assignments/${id}`),
  close: (id: string) => apiClient.post(`/assignments/${id}/close`).then(r => r.data),
  myTasks: (params?: { state?: string }) =>
    apiClient.get<ApiEnvelope<AssignmentTask[]>>('/me/tasks', { params }).then(r => r.data),
  listByClass: (classId: string) =>
    apiClient.get<ApiEnvelope<AssignmentTask[]>>('/assignments', { params: { class_id: classId } }).then(r => r.data),
  // Submit assignment (multipart: file + note + optional user_id)
  submitAssignment: (taskId: string, file: File, note?: string, userId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (note) fd.append('note', note);
    if (userId) fd.append('user_id', userId);
    return apiClient.post<ApiEnvelope<Submission>>(
      `/assignments/${taskId}/submissions`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data);
  },
  listSubmissions: (taskId: string, params?: { status?: string; search?: string }) =>
    apiClient.get<ApiEnvelope<Submission[]>>(`/assignments/${taskId}/submissions`, { params }).then(r => r.data),
  // Download submission file
  downloadSubmission: async (submissionId: string, filename: string): Promise<void> => {
    const response = await apiClient.get(`/submissions/${submissionId}/file`, { responseType: 'blob' });
    triggerDownload(response.data as Blob, filename);
  },
};
