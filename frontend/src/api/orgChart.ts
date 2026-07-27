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
  sub_mentors: OrgChartPerson[];
  participants: OrgChartPerson[];
  sub_groups: OrgChartSubGroup[];
  lead_mentor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface OrgChartData {
  stats: {
    total_admins: number;
    total_groups: number;
    total_sub_mentors: number;
    total_participants: number;
    total_lead_mentors: number;
    total_sub_groups: number;
  };
  admins: OrgChartPerson[];
  groups: OrgChartGroup[];
  unassigned_sub_mentors: OrgChartPerson[];
}

export const orgChartApi = {
  get: () =>
    apiClient.get<ApiEnvelope<OrgChartData>>('/admin/org-chart').then(r => r.data),
};
