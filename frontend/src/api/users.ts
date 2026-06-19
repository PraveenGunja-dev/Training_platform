import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, User } from '@/lib/types';

export const usersApi = {
  list: (params?: {
    role?: string;
    status?: string;
    setup?: string;
    search?: string;
    business_unit?: string;
    group_admin?: boolean;
    page?: number;
    page_size?: number;
  }) => apiClient.get<ApiEnvelope<User[]>>('/users', { params }).then(r => r.data),
  businessUnits: () =>
    apiClient.get<ApiEnvelope<string[]>>('/users/business-units').then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<User>>(`/users/${id}`).then(r => r.data),
  invite: (body: { email: string; role: string; full_name?: string; group_ids?: string[] }) =>
    apiClient.post<ApiEnvelope<User>>('/users', body).then(r => r.data),
  update: (id: string, body: Partial<Pick<User, 'full_name' | 'photo_url' | 'role' | 'is_active'>>) =>
    apiClient.patch<ApiEnvelope<User>>(`/users/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  resendInvite: (id: string) => apiClient.post(`/users/${id}/resend-invite`),
  bulkInvite: (rows: Array<{ email: string; role: string; full_name?: string; group_ids?: string[] }>) =>
    apiClient.post('/users/bulk-invite', { rows }).then(r => r.data),
  listInstructors: (q?: string) =>
    apiClient.get<ApiEnvelope<User[]>>('/instructors', { params: q ? { q } : undefined }).then(r => r.data),
  setVisibility: (id: string, can_view_all_classes: boolean | null) =>
    apiClient.patch<ApiEnvelope<User>>(`/users/${id}/visibility`, { can_view_all_classes }).then(r => r.data),
  stats: () =>
    apiClient.get<ApiEnvelope<{ total: number; admins: number; instructors: number; participants: number; group_admins: number; active: number; blocked: number }>>('/users/stats').then(r => r.data),
  checkEmailExists: (email: string) =>
    apiClient.get<ApiEnvelope<{ exists: boolean }>>(`/users/check-email?email=${encodeURIComponent(email)}`).then(r => r.data),
};
