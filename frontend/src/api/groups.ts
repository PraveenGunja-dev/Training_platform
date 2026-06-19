import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, ClassGroup, GroupDetail, GroupAnalytics, GroupInstructor, SubGroup, GroupAdminData } from '@/lib/types';

export const groupsApi = {
  list: (params?: { is_archived?: boolean; search?: string; sort?: string }) =>
    apiClient.get<ApiEnvelope<ClassGroup[]>>('/groups', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<GroupDetail>>(`/groups/${id}`).then(r => r.data),
  analytics: (id: string, params?: { sub_group_id?: string }) =>
    apiClient.get<ApiEnvelope<GroupAnalytics>>(`/groups/${id}/analytics`, { params }).then(r => r.data),
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
  availableInstructors: (id: string, search?: string) =>
    apiClient.get<ApiEnvelope<{ id: string; full_name: string; email: string }[]>>(
      `/groups/${id}/available-instructors${search ? `?search=${encodeURIComponent(search)}` : ''}`
    ).then(r => r.data),
  listSubGroups: (groupId: string) =>
    apiClient.get<ApiEnvelope<SubGroup[]>>(`/groups/${groupId}/sub-groups`).then(r => r.data),
  getSubGroup: (groupId: string, subGroupId: string) =>
    apiClient.get<ApiEnvelope<SubGroup>>(`/groups/${groupId}/sub-groups/${subGroupId}`).then(r => r.data),
  createSubGroup: (groupId: string, body: { name: string; user_ids: string[] }) =>
    apiClient.post<ApiEnvelope<SubGroup>>(`/groups/${groupId}/sub-groups`, body).then(r => r.data),
  updateSubGroup: (groupId: string, subGroupId: string, body: { name?: string; user_ids?: string[] }) =>
    apiClient.patch<ApiEnvelope<SubGroup>>(`/groups/${groupId}/sub-groups/${subGroupId}`, body).then(r => r.data),
  deleteSubGroup: (groupId: string, subGroupId: string) =>
    apiClient.delete(`/groups/${groupId}/sub-groups/${subGroupId}`),
  getGroupAdmin: (groupId: string) =>
    apiClient.get<ApiEnvelope<GroupAdminData | null>>(`/groups/${groupId}/admin`).then(r => r.data),
  assignGroupAdmin: (groupId: string, userId: string) =>
    apiClient.put<ApiEnvelope<GroupAdminData>>(`/groups/${groupId}/admin`, { user_id: userId }).then(r => r.data),
  removeGroupAdmin: (groupId: string) =>
    apiClient.delete(`/groups/${groupId}/admin`),
};
