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

type AuditFilterParams = Pick<AuditListParams, 'actor_id' | 'action' | 'target_type' | 'from' | 'to'>;

export const auditApi = {
  list: (params?: AuditListParams) =>
    apiClient.get<ApiEnvelope<AuditEntry[]>>('/audit', { params }).then(r => r.data),

  exportUrl: (filters: AuditFilterParams): string => {
    const base = (import.meta.env.VITE_API_BASE_URL ?? '/training/api/v1') + '/audit/export';
    const params = new URLSearchParams();
    if (filters.actor_id)    params.set('actor_id',    filters.actor_id);
    if (filters.action)      params.set('action',      filters.action);
    if (filters.target_type) params.set('target_type', filters.target_type);
    if (filters.from)        params.set('from',        `${filters.from}T00:00:00Z`);
    if (filters.to)          params.set('to',          `${filters.to}T23:59:59Z`);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  },
};
