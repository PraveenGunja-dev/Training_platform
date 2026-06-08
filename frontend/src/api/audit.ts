import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, AuditEntry } from '@/lib/types';

export const auditApi = {
  list: (params?: {
    actor_id?: string;
    action?: string;
    target_type?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }) => apiClient.get<ApiEnvelope<AuditEntry[]>>('/audit', { params }).then(r => r.data),
};
