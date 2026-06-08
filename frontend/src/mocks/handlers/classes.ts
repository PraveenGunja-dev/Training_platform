import { http, HttpResponse } from 'msw';
import { classesData } from '../data/classes';
import { attendanceRecordsData, attendanceSessions, attendanceRecords } from '../data/attendance';
import { groupsData, groupMemberships } from '../data/groups';
import { usersData } from '../data/users';
import { mockAuthState } from '../data/seed';
import type { ClassSession, ClassStatus } from '@/lib/types';

function withAttendance(cls: ClassSession, userId: string): ClassSession {
  const legacyRec = attendanceRecordsData.find(r => r.class_id === cls.id && r.user_id === userId);
  const activeSession = attendanceSessions.find(s => s.class_id === cls.id && s.status === 'ACTIVE') ?? null;
  const myRecord = activeSession
    ? (attendanceRecords.find(r => r.session_id === activeSession.id && r.user_id === userId) ?? null)
    : null;
  const participantsCount = groupMemberships[cls.group_id]?.participant_ids.length ?? 0;
  return {
    ...cls,
    attendance_status: legacyRec?.status ?? null,
    attendance_marked_at: legacyRec?.marked_at ?? null,
    active_session: activeSession,
    my_record: myRecord,
    participants_count: participantsCount,
  };
}

export const classesHandlers = [
  http.get('*/api/v1/classes', ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('filter[group_id]') ?? url.searchParams.get('group_id');
    const status = url.searchParams.get('filter[status]') ?? url.searchParams.get('status');
    const from = url.searchParams.get('filter[from]') ?? url.searchParams.get('from');
    const to = url.searchParams.get('filter[to]') ?? url.searchParams.get('to');

    let items = [...classesData];

    if (!groupId) {
      const userId = mockAuthState.currentUserId;
      const user = usersData.find(u => u.id === userId);
      if (user?.role === 'PARTICIPANT') {
        const memberGroupIds = Object.entries(groupMemberships)
          .filter(([, m]) => m.participant_ids.includes(userId))
          .map(([id]) => id);
        items = items.filter(c => memberGroupIds.includes(c.group_id));
      }
    }

    if (groupId) items = items.filter(c => c.group_id === groupId);
    if (status) items = items.filter(c => c.status === status);
    if (from) items = items.filter(c => c.starts_at >= from);
    if (to) items = items.filter(c => c.starts_at <= to);

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.get('*/api/v1/me/calendar', ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const userId = mockAuthState.currentUserId;

    let items = classesData.filter(c => c.group_id === 'g-batch-a' || c.group_id === 'g-batch-d');
    if (from) items = items.filter(c => c.starts_at >= from);
    if (to) items = items.filter(c => c.starts_at <= to);

    return HttpResponse.json({
      data: items.map(c => withAttendance(c, userId)),
      meta: { total: items.length },
    });
  }),

  http.get('*/api/v1/classes/:id', ({ params }) => {
    const cls = classesData.find(c => c.id === params.id);
    if (!cls) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Class not found.' }] },
        { status: 404 },
      );
    }
    const userId = mockAuthState.currentUserId;
    return HttpResponse.json({ data: withAttendance(cls, userId) });
  }),

  http.post('*/api/v1/classes', async ({ request }) => {
    const body = await request.json() as Partial<ClassSession> & { group_id: string; starts_at: string; ends_at: string };
    const group = groupsData.find(g => g.id === body.group_id);
    const newClass: ClassSession = {
      id: 'c-' + Math.random().toString(36).slice(2, 8),
      group_id: body.group_id,
      group_name: group?.name ?? body.group_name ?? '',
      title: body.title ?? '',
      description: body.description ?? '',
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      attendance_open_at: body.attendance_open_at ?? body.starts_at,
      attendance_close_at: body.attendance_close_at ?? body.ends_at,
      allow_late_attendance: body.allow_late_attendance ?? false,
      status: 'UPCOMING' as ClassStatus,
    };
    classesData.push(newClass);
    return HttpResponse.json({ data: newClass }, { status: 201 });
  }),

  http.patch('*/api/v1/classes/:id', async ({ request, params }) => {
    const idx = classesData.findIndex(c => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Class not found.' }] }, { status: 404 });
    const body = await request.json() as Partial<ClassSession>;
    classesData[idx] = { ...classesData[idx], ...body };
    return HttpResponse.json({ data: classesData[idx] });
  }),

  http.delete('*/api/v1/classes/:id', ({ params }) => {
    const idx = classesData.findIndex(c => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Class not found.' }] }, { status: 404 });
    classesData.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
