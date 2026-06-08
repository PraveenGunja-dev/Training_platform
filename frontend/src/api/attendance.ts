import { apiClient } from '@/lib/api-client';
import type {
  ApiEnvelope,
  ActiveSessionResponse,
  AttendanceRecord,
  AttendanceRow,
  AttendanceSession,
  AttendanceStatus,
  AttendanceReportData,
  SessionsListFilter,
} from '@/lib/types';

export const attendanceApi = {
  activeSession: () =>
    apiClient.get<ApiEnvelope<ActiveSessionResponse>>('/attendance/active-session').then(r => r.data),
  mark: (sessionId: string) =>
    apiClient.post<ApiEnvelope<AttendanceRecord>>(`/attendance/sessions/${sessionId}/mark`).then(r => r.data),

  // Admin attendance list + override (pre-v2 shape, kept for admin detail pages)
  list: (classId: string) =>
    apiClient.get<ApiEnvelope<AttendanceRow[]>>(`/classes/${classId}/attendance`).then(r => r.data),
  override: (classId: string, userId: string, body: { status: AttendanceStatus; note?: string }) =>
    apiClient.patch<ApiEnvelope<AttendanceRow>>(`/classes/${classId}/attendance/${userId}`, body).then(r => r.data),

  // Admin session-based endpoints (v2)
  admin: {
    startSession: (class_id: string, duration_minutes?: number) =>
      apiClient.post<ApiEnvelope<AttendanceSession>>('/admin/attendance/sessions', { class_id, duration_minutes }).then(r => r.data),
    endSession: (id: string) =>
      apiClient.post<ApiEnvelope<AttendanceSession>>(`/admin/attendance/sessions/${id}/end`).then(r => r.data),
    listSessions: (params?: SessionsListFilter) =>
      apiClient.get<ApiEnvelope<AttendanceSession[]>>('/admin/attendance/sessions', { params }).then(r => r.data),
    sessionReport: (id: string) =>
      apiClient.get<ApiEnvelope<AttendanceReportData>>(`/admin/attendance/sessions/${id}/report`).then(r => r.data),
  },
};
