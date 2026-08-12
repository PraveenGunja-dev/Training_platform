import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, AuditEntry } from '@/lib/types';

type AuditListParams = {
  actor_id?: string;
  action?: string;
  target_type?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export const auditApi = {
  list: (params?: AuditListParams) =>
    apiClient.get<ApiEnvelope<AuditEntry[]>>('/audit', { params }).then(r => r.data),
};
