import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, ClassGroup, GroupDetail, GroupAnalytics, GroupSubMentor, SubGroup, LeadMentorData } from '@/lib/types';

export const groupsApi = {
  list: (params?: { is_archived?: boolean; search?: string; sort?: string }) =>
    apiClient.get<ApiEnvelope<ClassGroup[]>>('/groups', { params }).then(r => {
      if (r.data && Array.isArray(r.data.data)) {
        r.data.data.sort((a, b) => a.name.replace(/[-_]/g, ' ').localeCompare(b.name.replace(/[-_]/g, ' '), undefined, { numeric: true, sensitivity: 'base' }));
      }
      return r.data;
    }),
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
  getSubMentors: (id: string) =>
    apiClient.get<ApiEnvelope<GroupSubMentor[]>>(`/groups/${id}/sub-mentors`).then(r => r.data),
  assignSubMentors: (id: string, user_ids: string[], promote_participants?: boolean) =>
    apiClient.post<ApiEnvelope<GroupSubMentor[]>>(
      `/groups/${id}/sub-mentors`,
      promote_participants ? { user_ids, promote_participants: true } : { user_ids },
    ).then(r => r.data),
  unassignSubMentor: (id: string, userId: string) =>
    apiClient.delete(`/groups/${id}/sub-mentors/${userId}`),
  availableSubMentors: (id: string, search?: string) =>
    apiClient.get<ApiEnvelope<{ id: string; full_name: string; email: string }[]>>(
      `/groups/${id}/available-sub-mentors${search ? `?search=${encodeURIComponent(search)}` : ''}`
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
  getLeadMentor: (groupId: string) =>
    apiClient.get<ApiEnvelope<LeadMentorData | null>>(`/groups/${groupId}/lead-mentor`).then(r => r.data),
  assignLeadMentor: (groupId: string, userId: string) =>
    apiClient.put<ApiEnvelope<LeadMentorData>>(`/groups/${groupId}/lead-mentor`, { user_id: userId }).then(r => r.data),
  removeLeadMentor: (groupId: string) =>
    apiClient.delete(`/groups/${groupId}/lead-mentor`),
};
