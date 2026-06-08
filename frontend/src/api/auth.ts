import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, User } from '@/lib/types';

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiClient.post<ApiEnvelope<{ access: string; user: User }>>('/auth/login', body).then(r => r.data),
  refresh: () =>
    apiClient.post<ApiEnvelope<{ access: string }>>('/auth/refresh').then(r => r.data),
  logout: () => apiClient.post('/auth/logout'),
  setPassword: (body: { token: string; password: string }) =>
    apiClient.post<ApiEnvelope<{ access: string; user: User }>>('/auth/set-password', body).then(r => r.data),
  me: () =>
    apiClient.get<ApiEnvelope<User>>('/me').then(r => r.data),
  updateProfile: (data: { full_name?: string; photo_url?: string }) =>
    apiClient.patch<ApiEnvelope<User>>('/me', data).then(r => r.data),
  uploadPhoto: (file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return apiClient.post<ApiEnvelope<User>>('/me/photo', fd).then(r => r.data);
  },
  changePassword: (data: { current: string; new_password: string }) =>
    apiClient.post('/me/password', { current_password: data.current, new_password: data.new_password }),
  changeEmail: (data: { current_email: string; new_email: string; current_password: string }) =>
    apiClient.post<ApiEnvelope<{ email: string; detail: string }>>('/me/email', data).then(r => r.data),
};
