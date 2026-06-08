import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, SystemSettings } from '@/lib/types';

export const settingsApi = {
  get: () =>
    apiClient.get<ApiEnvelope<SystemSettings>>('/admin/settings').then(r => r.data),
  update: (body: Partial<SystemSettings>) =>
    apiClient.patch<ApiEnvelope<SystemSettings>>('/admin/settings', body).then(r => r.data),
  forceLogout: () =>
    apiClient
      .post<ApiEnvelope<{ cleared: number }>>('/admin/settings/force-logout')
      .then(r => r.data),
};
