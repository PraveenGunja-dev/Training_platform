import { http, HttpResponse } from 'msw';
import {
  attendanceRecordsData,
  attendanceSessions,
  attendanceRecords,
  getActiveSessionForUser,
  buildReport,
} from '../data/attendance';
import { classesData } from '../data/classes';
import { groupMemberships } from '../data/groups';
import { usersData } from '../data/users';
import { mockAuthState } from '../data/seed';
import { auditData } from '../data/audit';
import type { AttendanceStatus } from '@/lib/types';

export const attendanceHandlers = [
  // ── Participant: poll for active session ────────────────────────────────────
  http.get('*/api/v1/attendance/active-session', () => {
    const userId = mockAuthState.currentUserId;
    const result = getActiveSessionForUser(userId);
    return HttpResponse.json({ data: result });
  }),

  // ── Participant: mark attendance ────────────────────────────────────────────
  http.post('*/api/v1/attendance/sessions/:id/mark', ({ params }) => {
    const sessionId = params.id as string;
    const userId = mockAuthState.currentUserId;

    const session = attendanceSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'ACTIVE') {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'attendance.session_ended', message: 'Session has ended.' }] },
        { status: 422 },
      );
    }

    const membership = groupMemberships[session.group_id];
    if (!membership?.participant_ids.includes(userId)) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'perm.not_in_group', message: 'Not a member of this group.' }] },
        { status: 403 },
      );
    }

    if (attendanceRecords.some(r => r.session_id === sessionId && r.user_id === userId)) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'attendance.already_marked', message: 'Already marked.' }] },
        { status: 409 },
      );
    }

    const record = {
      id: `r-${Math.random().toString(36).slice(2, 8)}`,
      session_id: sessionId,
      user_id: userId,
      marked_at: new Date().toISOString(),
      status: 'PRESENT' as const,
    };
    attendanceRecords.push(record);
    return HttpResponse.json({ data: record });
  }),

  // ── Admin: list attendance for a class (legacy — used until F-X-05 adds report) ──
  http.get('*/api/v1/classes/:classId/attendance', ({ params }) => {
    const classId = params.classId as string;
    const cls = classesData.find(c => c.id === classId);
    if (!cls) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Class not found.' }] },
        { status: 404 },
      );
    }
    const participantIds = groupMemberships[cls.group_id]?.participant_ids ?? [];

    const rows = participantIds.map(uid => {
      const user = usersData.find(u => u.id === uid);
      const rec = attendanceRecordsData.find(r => r.class_id === classId && r.user_id === uid);
      return {
        user: { id: uid, full_name: user?.full_name ?? uid, email: user?.email ?? '' },
        status: rec?.status ?? null,
        marked_at: rec?.marked_at ?? null,
        override_by: rec?.override_by ?? null,
        note: rec?.note ?? '',
      };
    });

    return HttpResponse.json({ data: rows, meta: { total: rows.length } });
  }),

  // ── Admin: start session ────────────────────────────────────────────────────
  http.post('*/api/v1/admin/attendance/sessions', async ({ request }) => {
    const body = await request.json() as { class_id: string };
    const cls = classesData.find(c => c.id === body.class_id);
    if (!cls) {
      return HttpResponse.json({ errors: [{ code: 'not_found', message: 'Class not found.' }] }, { status: 404 });
    }

    const now = new Date();
    const starts = new Date(cls.starts_at);
    const ends = new Date(cls.ends_at);
    if (now < starts || now > ends) {
      return HttpResponse.json(
        { errors: [{ code: 'attendance.class_not_in_window', message: 'Class is not currently ongoing.' }] },
        { status: 422 },
      );
    }

    if (attendanceSessions.some(s => s.class_id === body.class_id && s.status === 'ACTIVE')) {
      return HttpResponse.json(
        { errors: [{ code: 'attendance.session_already_active', message: 'A session is already active.' }] },
        { status: 409 },
      );
    }

    const adminId = mockAuthState.currentUserId;
    const admin = usersData.find(u => u.id === adminId);
    const session = {
      id: `as-${Date.now()}`,
      class_id: cls.id,
      class_title: cls.title,
      group_id: cls.group_id,
      started_at: now.toISOString(),
      started_by: { id: adminId, full_name: admin?.full_name ?? 'Admin' },
      ended_at: null as string | null,
      ended_by: null as { id: string; full_name: string } | null,
      status: 'ACTIVE' as const,
      duration_minutes: null as number | null,
      scheduled_end_at: null as string | null,
    };
    attendanceSessions.push(session);
    return HttpResponse.json({ data: session }, { status: 201 });
  }),

  // ── Admin: end session ──────────────────────────────────────────────────────
  http.post('*/api/v1/admin/attendance/sessions/:id/end', ({ params }) => {
    const session = attendanceSessions.find(s => s.id === params.id);
    if (!session) {
      return HttpResponse.json({ errors: [{ code: 'not_found', message: 'Session not found.' }] }, { status: 404 });
    }
    if (session.status !== 'ACTIVE') {
      return HttpResponse.json(
        { errors: [{ code: 'attendance.session_already_ended', message: 'Session has already ended.' }] },
        { status: 409 },
      );
    }
    const adminId = mockAuthState.currentUserId;
    const admin = usersData.find(u => u.id === adminId);
    session.status = 'ENDED';
    session.ended_at = new Date().toISOString();
    session.ended_by = { id: adminId, full_name: admin?.full_name ?? 'Admin' };
    return HttpResponse.json({ data: session });
  }),

  // ── Admin: list sessions ────────────────────────────────────────────────────
  http.get('*/api/v1/admin/attendance/sessions', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const classId = url.searchParams.get('class_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let items = [...attendanceSessions];
    if (status) items = items.filter(s => s.status === status);
    if (classId) items = items.filter(s => s.class_id === classId);
    if (from) items = items.filter(s => s.started_at >= from);
    if (to) items = items.filter(s => s.started_at <= to);

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  // ── Admin: session report ───────────────────────────────────────────────────
  http.get('*/api/v1/admin/attendance/sessions/:id/report', ({ params }) => {
    const session = attendanceSessions.find(s => s.id === params.id);
    if (!session) {
      return HttpResponse.json({ errors: [{ code: 'not_found', message: 'Session not found.' }] }, { status: 404 });
    }
    const report = buildReport(session.id);
    return HttpResponse.json({ data: { session, records: report.rows, summary: report.summary } });
  }),

  // ── Admin: override attendance record (legacy) ──────────────────────────────
  http.patch('*/api/v1/classes/:classId/attendance/:userId', async ({ request, params }) => {
    const body = await request.json() as { status: AttendanceStatus; note?: string };
    const classId = params.classId as string;
    const userId = params.userId as string;
    const actorId = mockAuthState.currentUserId;
    const actor = usersData.find(u => u.id === actorId);

    const idx = attendanceRecordsData.findIndex(r => r.class_id === classId && r.user_id === userId);
    let record;
    if (idx === -1) {
      record = {
        id: 'att-' + Math.random().toString(36).slice(2, 8),
        class_id: classId, user_id: userId,
        status: body.status, marked_at: null, override_by: actorId, note: body.note ?? '',
      };
      attendanceRecordsData.push(record);
    } else {
      attendanceRecordsData[idx] = {
        ...attendanceRecordsData[idx],
        status: body.status,
        note: body.note ?? attendanceRecordsData[idx].note,
        override_by: actorId,
      };
      record = attendanceRecordsData[idx];
    }

    auditData.push({
      id: 'audit-' + Math.random().toString(36).slice(2, 8),
      actor: { id: actorId, full_name: actor?.full_name ?? actorId, email: actor?.email ?? '' },
      action: 'attendance.override',
      target_type: 'AttendanceRecord',
      target_id: record.id,
      metadata: { new_status: body.status, user_id: userId, class_id: classId, note: body.note ?? '' },
      created_at: new Date().toISOString(),
    });

    return HttpResponse.json({ data: record });
  }),
];
