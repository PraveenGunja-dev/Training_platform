import { apiClient } from '@/lib/api-client';
import type {
  ApiEnvelope,
  ClassSession,
  AttendanceStatus,
  AssignmentTask,
  Document,
  Submission,
} from '@/lib/types';

export interface DashboardKpis {
  total_groups: number;
  total_participants: number;
  classes_today: number;
  classes_upcoming: number;
  classes_completed: number;
  submitted: number;
  pending: number;
  late: number;
  video_uploads: number;
  doc_uploads: number;
  pending_approvals: number;
}

export interface DashboardActivityEntry {
  id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
}

export interface ParticipantActivityItem {
  id: string;
  name: string;
  group_name: string;
  attendance_rate: number;
  submission_rate: number;
  last_activity: string | null;
}

export interface AdminDashboardData {
  kpis: DashboardKpis;
  charts: {
    attendance_pie: Array<{ label: string; value: number }>;
    submission_bar: Array<{ group_name: string; submitted: number; pending: number; late: number }>;
    group_comparison: Array<{ group_name: string; attendance_rate: number; submission_rate: number }>;
    daily_upload_trend: Array<{ date: string; count: number }>;
    deadline_tracking: Array<{ task_title: string; deadline_at: string; pending_count: number }>;
    class_status: Array<{ label: string; value: number }>;
    weekly_trend: Array<{ week: string; attendance_rate: number; submission_rate: number }>;
  };
  recent_documents: unknown[];
  recent_activity: DashboardActivityEntry[];
  participant_activity: ParticipantActivityItem[];
}

export interface TodayClassData {
  class: ClassSession | null;
  attendance_status: AttendanceStatus | null;
  mark_attendance_open: boolean;
  attendance_open_at?: string | null;
  attendance_close_at?: string | null;
}

export interface ParticipantDashboardData {
  today: TodayClassData;
  pending_tasks: AssignmentTask[];
  recent_documents: Document[];
  recent_submissions: Submission[];
  quick_stats: { attendance_rate: number; submitted_count: number; pending_count: number };
}

export interface GroupAdminDashboardData {
  group_name: string;
  kpis: {
    total_participants: number;
    total_instructors: number;
    total_sub_groups: number;
    total_assignments: number;
    classes_today: number;
    classes_upcoming: number;
    classes_completed: number;
    submitted: number;
    pending: number;
    late: number;
  };
  charts: {
    attendance_pie: Array<{ label: string; value: number }>;
    class_status: Array<{ label: string; value: number }>;
    weekly_trend: Array<{ week: string; attendance_rate: number; submission_rate: number }>;
    deadline_tracking: Array<{ task_title: string; deadline_at: string; pending_count: number }>;
  };
  participant_activity: ParticipantActivityItem[];
}

export const dashboardApi = {
  admin: (params?: { group_id?: string }) =>
    apiClient.get<ApiEnvelope<AdminDashboardData>>('/dashboard/admin', { params }).then(r => r.data),
  participant: () =>
    apiClient.get<ApiEnvelope<ParticipantDashboardData>>('/dashboard/participant').then(r => r.data),
  groupAdmin: () =>
    apiClient.get<ApiEnvelope<GroupAdminDashboardData>>('/dashboard/group-admin').then(r => r.data),
};
