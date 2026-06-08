import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, ClassSession } from '@/lib/types';

export const classesApi = {
  list: (params?: { group_id?: string; from?: string; to?: string; status?: string }) =>
    apiClient.get<ApiEnvelope<ClassSession[]>>('/classes', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<ClassSession>>(`/classes/${id}`).then(r => r.data),
  create: (body: {
    group_id: string; title: string; description?: string; meeting_link?: string;
    starts_at: string; ends_at: string;
    attendance_open_at?: string; attendance_close_at?: string;
    allow_late_attendance?: boolean;
  }) => apiClient.post<ApiEnvelope<ClassSession>>('/classes', body).then(r => r.data),
  update: (id: string, body: Partial<ClassSession>) =>
    apiClient.patch<ApiEnvelope<ClassSession>>(`/classes/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/classes/${id}`),
  myCalendar: (params?: { from?: string; to?: string }) =>
    apiClient.get<ApiEnvelope<ClassSession[]>>('/me/calendar', { params }).then(r => r.data),
  getParticipants: (classId: string) =>
    apiClient.get<ApiEnvelope<{ id: string; full_name: string; email: string }[]>>(
      `/classes/${classId}/participants`,
    ).then(r => r.data),
  shareQR: (classId: string, userIds: string[]) =>
    apiClient.post<ApiEnvelope<{ sent: number }>>(`/classes/${classId}/share-qr`, { user_ids: userIds }).then(r => r.data),
};
