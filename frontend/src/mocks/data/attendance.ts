import type { AttendanceSession, AttendanceRecord, ActiveSessionResponse, LegacyAttendanceRecord, ReportRow } from '@/lib/types';
import { classesData } from './classes';
import { groupMemberships } from './groups';
import { usersData } from './users';

// ── Legacy records (pre-v2) kept for admin override + class detail handler ────
export const attendanceRecordsData: LegacyAttendanceRecord[] = [
  // c-safety-a-1 (COMPLETED) — g-batch-a
  { id: 'att-a1-p01', class_id: 'c-safety-a-1', user_id: 'u-part', status: 'PRESENT', marked_at: '2026-05-05T04:20:00Z', override_by: null, note: '' },
  { id: 'att-a1-p02', class_id: 'c-safety-a-1', user_id: 'u-part-002', status: 'PRESENT', marked_at: '2026-05-05T04:22:00Z', override_by: null, note: '' },
  { id: 'att-a1-p03', class_id: 'c-safety-a-1', user_id: 'u-part-003', status: 'PRESENT', marked_at: '2026-05-05T04:25:00Z', override_by: null, note: '' },
  { id: 'att-a1-p04', class_id: 'c-safety-a-1', user_id: 'u-part-004', status: 'PRESENT', marked_at: '2026-05-05T04:28:00Z', override_by: null, note: '' },
  { id: 'att-a1-p05', class_id: 'c-safety-a-1', user_id: 'u-part-005', status: 'PRESENT', marked_at: '2026-05-05T04:30:00Z', override_by: null, note: '' },
  { id: 'att-a1-p06', class_id: 'c-safety-a-1', user_id: 'u-part-006', status: 'ABSENT', marked_at: null, override_by: null, note: '' },
  { id: 'att-a1-p07', class_id: 'c-safety-a-1', user_id: 'u-part-007', status: 'PRESENT', marked_at: '2026-05-05T04:35:00Z', override_by: null, note: '' },
  { id: 'att-a1-p08', class_id: 'c-safety-a-1', user_id: 'u-part-008', status: 'PRESENT', marked_at: '2026-05-05T04:40:00Z', override_by: null, note: '' },
  { id: 'att-a1-p09', class_id: 'c-safety-a-1', user_id: 'u-part-009', status: 'ABSENT', marked_at: null, override_by: null, note: '' },
  { id: 'att-a1-p10', class_id: 'c-safety-a-1', user_id: 'u-part-010', status: 'PRESENT', marked_at: '2026-05-05T04:45:00Z', override_by: null, note: '' },

  // c-safety-a-2 (COMPLETED) — g-batch-a
  { id: 'att-a2-p01', class_id: 'c-safety-a-2', user_id: 'u-part', status: 'MANUAL_PRESENT', marked_at: null, override_by: 'u-manager', note: 'Network issue; manually verified present.' },
  { id: 'att-a2-p02', class_id: 'c-safety-a-2', user_id: 'u-part-002', status: 'PRESENT', marked_at: '2026-05-08T04:10:00Z', override_by: null, note: '' },
  { id: 'att-a2-p03', class_id: 'c-safety-a-2', user_id: 'u-part-003', status: 'PRESENT', marked_at: '2026-05-08T04:12:00Z', override_by: null, note: '' },
  { id: 'att-a2-p04', class_id: 'c-safety-a-2', user_id: 'u-part-004', status: 'PRESENT', marked_at: '2026-05-08T04:15:00Z', override_by: null, note: '' },
  { id: 'att-a2-p05', class_id: 'c-safety-a-2', user_id: 'u-part-005', status: 'LATE', marked_at: '2026-05-08T04:50:00Z', override_by: null, note: '' },
  { id: 'att-a2-p06', class_id: 'c-safety-a-2', user_id: 'u-part-006', status: 'PRESENT', marked_at: '2026-05-08T04:18:00Z', override_by: null, note: '' },
  { id: 'att-a2-p07', class_id: 'c-safety-a-2', user_id: 'u-part-007', status: 'PRESENT', marked_at: '2026-05-08T04:20:00Z', override_by: null, note: '' },
  { id: 'att-a2-p08', class_id: 'c-safety-a-2', user_id: 'u-part-008', status: 'ABSENT', marked_at: null, override_by: null, note: '' },
  { id: 'att-a2-p09', class_id: 'c-safety-a-2', user_id: 'u-part-009', status: 'MANUAL_PRESENT', marked_at: null, override_by: 'u-manager', note: 'Confirmed in person.' },
  { id: 'att-a2-p10', class_id: 'c-safety-a-2', user_id: 'u-part-010', status: 'PRESENT', marked_at: '2026-05-08T04:22:00Z', override_by: null, note: '' },

  // c-safety-b-1 (COMPLETED) — g-batch-b
  { id: 'att-b1-p11', class_id: 'c-safety-b-1', user_id: 'u-part-011', status: 'PRESENT', marked_at: '2026-05-06T08:10:00Z', override_by: null, note: '' },
  { id: 'att-b1-p12', class_id: 'c-safety-b-1', user_id: 'u-part-012', status: 'PRESENT', marked_at: '2026-05-06T08:12:00Z', override_by: null, note: '' },
  { id: 'att-b1-p13', class_id: 'c-safety-b-1', user_id: 'u-part-013', status: 'PRESENT', marked_at: '2026-05-06T08:15:00Z', override_by: null, note: '' },
  { id: 'att-b1-p14', class_id: 'c-safety-b-1', user_id: 'u-part-014', status: 'ABSENT', marked_at: null, override_by: null, note: '' },
  { id: 'att-b1-p15', class_id: 'c-safety-b-1', user_id: 'u-part-015', status: 'PRESENT', marked_at: '2026-05-06T08:20:00Z', override_by: null, note: '' },
  { id: 'att-b1-p16', class_id: 'c-safety-b-1', user_id: 'u-part-016', status: 'PRESENT', marked_at: '2026-05-06T08:22:00Z', override_by: null, note: '' },
  { id: 'att-b1-p17', class_id: 'c-safety-b-1', user_id: 'u-part-017', status: 'PRESENT', marked_at: '2026-05-06T08:25:00Z', override_by: null, note: '' },
  { id: 'att-b1-p18', class_id: 'c-safety-b-1', user_id: 'u-part-018', status: 'PRESENT', marked_at: '2026-05-06T08:28:00Z', override_by: null, note: '' },
  { id: 'att-b1-p19', class_id: 'c-safety-b-1', user_id: 'u-part-019', status: 'LATE', marked_at: '2026-05-06T08:55:00Z', override_by: null, note: '' },
  { id: 'att-b1-p20', class_id: 'c-safety-b-1', user_id: 'u-part-020', status: 'ABSENT', marked_at: null, override_by: null, note: '' },

  // c-ops-1 (COMPLETED) — g-batch-c
  { id: 'att-c1-p21', class_id: 'c-ops-1', user_id: 'u-part-021', status: 'PRESENT', marked_at: '2026-05-07T03:15:00Z', override_by: null, note: '' },
  { id: 'att-c1-p22', class_id: 'c-ops-1', user_id: 'u-part-022', status: 'PRESENT', marked_at: '2026-05-07T03:18:00Z', override_by: null, note: '' },
  { id: 'att-c1-p23', class_id: 'c-ops-1', user_id: 'u-part-023', status: 'PRESENT', marked_at: '2026-05-07T03:20:00Z', override_by: null, note: '' },
  { id: 'att-c1-p24', class_id: 'c-ops-1', user_id: 'u-part-024', status: 'PRESENT', marked_at: '2026-05-07T03:22:00Z', override_by: null, note: '' },
  { id: 'att-c1-p25', class_id: 'c-ops-1', user_id: 'u-part-025', status: 'PRESENT', marked_at: '2026-05-07T03:25:00Z', override_by: null, note: '' },
  { id: 'att-c1-p26', class_id: 'c-ops-1', user_id: 'u-part-026', status: 'ABSENT', marked_at: null, override_by: null, note: '' },
  { id: 'att-c1-p27', class_id: 'c-ops-1', user_id: 'u-part-027', status: 'PRESENT', marked_at: '2026-05-07T03:28:00Z', override_by: null, note: '' },
  { id: 'att-c1-p28', class_id: 'c-ops-1', user_id: 'u-part-028', status: 'PRESENT', marked_at: '2026-05-07T03:30:00Z', override_by: null, note: '' },
  { id: 'att-c1-p29', class_id: 'c-ops-1', user_id: 'u-part-029', status: 'PRESENT', marked_at: '2026-05-07T03:32:00Z', override_by: null, note: '' },
  { id: 'att-c1-p30', class_id: 'c-ops-1', user_id: 'u-part-030', status: 'ABSENT', marked_at: null, override_by: null, note: '' },

  // c-ops-3 (past ONGOING) — some already marked
  { id: 'att-c3-p21', class_id: 'c-ops-3', user_id: 'u-part-021', status: 'PRESENT', marked_at: '2026-05-15T03:10:00Z', override_by: null, note: '' },
  { id: 'att-c3-p22', class_id: 'c-ops-3', user_id: 'u-part-022', status: 'PRESENT', marked_at: '2026-05-15T03:12:00Z', override_by: null, note: '' },
  { id: 'att-c3-p23', class_id: 'c-ops-3', user_id: 'u-part-023', status: 'PRESENT', marked_at: '2026-05-15T03:15:00Z', override_by: null, note: '' },

  // c-mgmt-1 (COMPLETED) — g-batch-d
  { id: 'att-d1-p01', class_id: 'c-mgmt-1', user_id: 'u-part', status: 'PRESENT', marked_at: '2026-05-08T09:10:00Z', override_by: null, note: '' },
  { id: 'att-d1-p05', class_id: 'c-mgmt-1', user_id: 'u-part-005', status: 'PRESENT', marked_at: '2026-05-08T09:12:00Z', override_by: null, note: '' },
  { id: 'att-d1-p11', class_id: 'c-mgmt-1', user_id: 'u-part-011', status: 'PRESENT', marked_at: '2026-05-08T09:15:00Z', override_by: null, note: '' },
  { id: 'att-d1-p21', class_id: 'c-mgmt-1', user_id: 'u-part-021', status: 'ABSENT', marked_at: null, override_by: null, note: '' },
  { id: 'att-d1-p25', class_id: 'c-mgmt-1', user_id: 'u-part-025', status: 'PRESENT', marked_at: '2026-05-08T09:20:00Z', override_by: null, note: '' },

  // c-safety-a-yesterday (COMPLETED 2026-05-14)
  { id: 'att-ay-p01', class_id: 'c-safety-a-yesterday', user_id: 'u-part', status: 'PRESENT', marked_at: '2026-05-14T04:22:00Z', override_by: null, note: '' },
  { id: 'att-ay-p02', class_id: 'c-safety-a-yesterday', user_id: 'u-part-002', status: 'PRESENT', marked_at: '2026-05-14T04:25:00Z', override_by: null, note: '' },
  { id: 'att-ay-p03', class_id: 'c-safety-a-yesterday', user_id: 'u-part-003', status: 'LATE', marked_at: '2026-05-14T04:40:00Z', override_by: null, note: '' },
];

// ── New session-based attendance data (v2) ────────────────────────────────────
export const attendanceSessions: AttendanceSession[] = [];
export const attendanceRecords: AttendanceRecord[] = [];

export function getActiveSessionForUser(userId: string): ActiveSessionResponse {
  const userGroupIds = Object.entries(groupMemberships)
    .filter(([, m]) => m.participant_ids.includes(userId))
    .map(([groupId]) => groupId);
  const session = attendanceSessions.find(
    s => s.status === 'ACTIVE' && userGroupIds.includes(s.group_id),
  ) ?? null;
  if (!session) return { session: null, my_record: null };
  const my_record = attendanceRecords.find(
    r => r.session_id === session.id && r.user_id === userId,
  ) ?? null;
  return { session, my_record };
}

// Dev simulation helpers — called from browser console or wired to DevSwitcher in F-X-05
export function simulateStartAttendance(classId: string, adminId = 'u-admin') {
  const cls = classesData.find(c => c.id === classId);
  if (!cls) throw new Error(`Class "${classId}" not found`);
  if (attendanceSessions.some(s => s.class_id === classId && s.status === 'ACTIVE')) {
    throw new Error('A session is already active for this class');
  }
  attendanceSessions.push({
    id: `as-${Date.now()}`,
    class_id: classId,
    class_title: cls.title,
    group_id: cls.group_id,
    started_at: new Date().toISOString(),
    started_by: { id: adminId, full_name: 'Asha Admin' },
    ended_at: null,
    ended_by: null,
    status: 'ACTIVE',
    duration_minutes: null,
    scheduled_end_at: null,
  });
}

export function simulateEndAttendance() {
  const active = attendanceSessions.find(s => s.status === 'ACTIVE');
  if (!active) return;
  active.status = 'ENDED';
  active.ended_at = new Date().toISOString();
  active.ended_by = { id: 'u-admin', full_name: 'Asha Admin' };
}

export function buildReport(sessionId: string): { rows: ReportRow[]; summary: { total: number; present: number; absent: number } } {
  const session = attendanceSessions.find(s => s.id === sessionId);
  if (!session) return { rows: [], summary: { total: 0, present: 0, absent: 0 } };

  const memberUserIds = groupMemberships[session.group_id]?.participant_ids ?? [];
  const memberUsers = usersData.filter(u => memberUserIds.includes(u.id));

  let presentCount = 0;
  const presentRows: ReportRow[] = [];
  const absentRows: ReportRow[] = [];

  for (const u of memberUsers) {
    const rec = attendanceRecords.find(r => r.session_id === sessionId && r.user_id === u.id);
    const row: ReportRow = {
      user: { id: u.id, full_name: u.full_name, email: u.email },
      status: rec ? 'PRESENT' : 'ABSENT',
      marked_at: rec?.marked_at ?? null,
    };
    if (rec) {
      presentCount++;
      presentRows.push(row);
    } else {
      absentRows.push(row);
    }
  }

  presentRows.sort((a, b) => (a.marked_at ?? '').localeCompare(b.marked_at ?? ''));
  absentRows.sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));

  const rows = [...presentRows, ...absentRows];
  return {
    rows,
    summary: { total: rows.length, present: presentCount, absent: rows.length - presentCount },
  };
}
