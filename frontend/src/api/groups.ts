import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, ClassGroup, GroupDetail, GroupAnalytics, GroupInstructor } from '@/lib/types';

export const groupsApi = {
  list: (params?: { is_archived?: boolean; search?: string; sort?: string }) =>
    apiClient.get<ApiEnvelope<ClassGroup[]>>('/groups', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<GroupDetail>>(`/groups/${id}`).then(r => r.data),
  analytics: (id: string) =>
    apiClient.get<ApiEnvelope<GroupAnalytics>>(`/groups/${id}/analytics`).then(r => r.data),
  create: (body: { name: string; description?: string }) =>
    apiClient.post<ApiEnvelope<ClassGroup>>('/groups', body).then(r => r.data),
  update: (id: string, body: Partial<{ name: string; description: string; is_archived: boolean }>) =>
    apiClient.patch<ApiEnvelope<ClassGroup>>(`/groups/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/groups/${id}`),
  addParticipants: (id: string, user_ids: string[]) =>
    apiClient.post(`/groups/${id}/participants`, { user_ids }).then(r => r.data),
  removeParticipant: (id: string, userId: string) =>
    apiClient.delete(`/groups/${id}/participants/${userId}`),
  getInstructors: (id: string) =>
    apiClient.get<ApiEnvelope<GroupInstructor[]>>(`/groups/${id}/instructors`).then(r => r.data),
  assignInstructors: (id: string, user_ids: string[]) =>
    apiClient.post<ApiEnvelope<GroupInstructor[]>>(`/groups/${id}/instructors`, { user_ids }).then(r => r.data),
  unassignInstructor: (id: string, userId: string) =>
    apiClient.delete(`/groups/${id}/instructors/${userId}`),
};
