import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, Notification, NotificationPreference } from '@/lib/types';

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; cursor?: string; limit?: number }) =>
    apiClient.get<ApiEnvelope<Notification[]>>('/notifications', { params }).then(r => r.data),
  unreadCount: () =>
    apiClient.get<ApiEnvelope<{ unread_count: number }>>('/notifications/unread-count').then(r => r.data),
  markRead: (id: string) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
  getPreferences: () =>
    apiClient.get<ApiEnvelope<NotificationPreference>>('/me/notification-preferences').then(r => r.data),
  updatePreferences: (data: Partial<Pick<NotificationPreference, 'email_enabled' | 'digest_submissions'>>) =>
    apiClient.patch<ApiEnvelope<NotificationPreference>>('/me/notification-preferences', data).then(r => r.data),
};
