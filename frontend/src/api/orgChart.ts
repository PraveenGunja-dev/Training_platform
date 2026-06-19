import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/lib/types';

export interface OrgChartPerson {
  id: string;
  name: string;
  email: string;
}

export interface OrgChartSubGroup {
  id: string;
  name: string;
  participants: OrgChartPerson[];
  participants_count: number;
}

export interface OrgChartGroup {
  id: string;
  name: string;
  is_archived: boolean;
  instructors: OrgChartPerson[];
  participants: OrgChartPerson[];
  sub_groups: OrgChartSubGroup[];
  group_admin: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface OrgChartData {
  stats: {
    total_admins: number;
    total_groups: number;
    total_instructors: number;
    total_participants: number;
    total_group_admins: number;
    total_sub_groups: number;
  };
  admins: OrgChartPerson[];
  groups: OrgChartGroup[];
  unassigned_instructors: OrgChartPerson[];
}

export const orgChartApi = {
  get: () =>
    apiClient.get<ApiEnvelope<OrgChartData>>('/admin/org-chart').then(r => r.data),
};
