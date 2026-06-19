import { http, HttpResponse } from 'msw';
import { groupsData, groupMemberships } from '../data/groups';
import { usersData } from '../data/users';
import { mockAuthState } from '../data/seed';
import { classesData } from '../data/classes';
import { attendanceRecordsData } from '../data/attendance';
import { assignmentsData } from '../data/assignments';
import { submissionsData } from '../data/submissions';
import type { ClassGroup, GroupAnalytics } from '@/lib/types';

function pseudoStat(seed: string, min = 60, max = 100): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h >>> 0;
  }
  return min + (h % (max - min + 1));
}

function enrichParticipants(groupId: string, participantIds: string[]) {
  return participantIds.map(uid => {
    const user = usersData.find(u => u.id === uid);
    if (!user) return null;

    const groupClasses = classesData.filter(c => c.group_id === groupId);
    const present = attendanceRecordsData.filter(r =>
      r.user_id === uid &&
      groupClasses.some(c => c.id === r.class_id) &&
      (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'MANUAL_PRESENT'),
    ).length;
    const attendance_rate = groupClasses.length > 0
      ? Math.round((present / groupClasses.length) * 100)
      : pseudoStat(uid + groupId + 'att');

    const groupTasks = assignmentsData.filter(t => t.group_id === groupId);
    const submitted = submissionsData.filter(s =>
      s.user_id === uid && groupTasks.some(t => t.id === s.task_id),
    ).length;
    const submission_rate = groupTasks.length > 0
      ? Math.round((submitted / groupTasks.length) * 100)
      : pseudoStat(uid + groupId + 'sub');

    return { ...user, attendance_rate, submission_rate };
  }).filter(Boolean);
}

function buildAnalytics(groupId: string): GroupAnalytics {
  const groupTasks = assignmentsData.filter(t => t.group_id === groupId);
  const membership = groupMemberships[groupId];
  const partIds = membership?.participant_ids ?? [];

  const totalTasks = groupTasks.length;
  const completedSubmissions = submissionsData.filter(s =>
    partIds.includes(s.user_id) && groupTasks.some(t => t.id === s.task_id),
  ).length;

  const seed = groupId;
  const attendance_trend = [
    { week: 'Apr 21', rate: pseudoStat(seed + '1', 70, 90) },
    { week: 'Apr 28', rate: pseudoStat(seed + '2', 70, 95) },
    { week: 'May 5', rate: pseudoStat(seed + '3', 75, 100) },
    { week: 'May 12', rate: pseudoStat(seed + '4', 75, 100) },
  ];

  const top_participants = partIds.slice(0, 5).map(uid => {
    const user = usersData.find(u => u.id === uid);
    return {
      id: uid,
      name: user?.full_name ?? uid,
      attendance_rate: pseudoStat(uid + 'top-att', 70, 100),
      submissions: pseudoStat(uid + 'top-sub', 0, totalTasks || 3),
    };
  });

  return {
    attendance_trend,
    submission_completion: { completed: completedSubmissions, total: partIds.length * totalTasks || 1 },
    top_participants,
  };
}

export const groupsHandlers = [
  http.get('*/api/v1/groups', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const isArchived = url.searchParams.get('filter[is_archived]') ?? url.searchParams.get('is_archived');

    const currentUser = usersData.find(u => u.id === mockAuthState.currentUserId);

    let items = [...groupsData];

    if (currentUser?.role === 'PARTICIPANT') {
      const participantGroupIds = Object.entries(groupMemberships)
        .filter(([, m]) => m.participant_ids.includes(currentUser.id))
        .map(([gid]) => gid);
      items = items.filter(g => participantGroupIds.includes(g.id));
    }
    // ADMIN sees all groups (no filter)

    if (search) items = items.filter(g => g.name.toLowerCase().includes(search));
    if (isArchived !== null) items = items.filter(g => String(g.is_archived) === isArchived);

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.get('*/api/v1/groups/:id/analytics', ({ params }) => {
    const groupId = params.id as string;
    const group = groupsData.find(g => g.id === groupId);
    if (!group) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Group not found.' }] },
        { status: 404 },
      );
    }

    return HttpResponse.json({ data: buildAnalytics(groupId) });
  }),

  http.get('*/api/v1/groups/:id', ({ params }) => {
    const groupId = params.id as string;
    const group = groupsData.find(g => g.id === groupId);
    if (!group) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Group not found.' }] },
        { status: 404 },
      );
    }

    const membership = groupMemberships[group.id];
    const participants = enrichParticipants(group.id, membership?.participant_ids ?? []);

    return HttpResponse.json({ data: { ...group, participants } });
  }),

  http.post('*/api/v1/groups', async ({ request }) => {
    const body = await request.json() as { name: string; description?: string };
    const newGroup: ClassGroup = {
      id: 'g-' + Math.random().toString(36).slice(2, 8),
      name: body.name, description: body.description ?? '',
      participants_count: 0,
      is_archived: false, created_at: new Date().toISOString(), instructors: [],
    };
    groupsData.push(newGroup);
    groupMemberships[newGroup.id] = { participant_ids: [] };
    return HttpResponse.json({ data: newGroup }, { status: 201 });
  }),

  http.patch('*/api/v1/groups/:id', async ({ request, params }) => {
    const idx = groupsData.findIndex(g => g.id === params.id);
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Group not found.' }] },
        { status: 404 },
      );
    }
    const body = await request.json() as Partial<ClassGroup>;
    groupsData[idx] = { ...groupsData[idx], ...body };
    return HttpResponse.json({ data: groupsData[idx] });
  }),

  http.delete('*/api/v1/groups/:id', ({ params }) => {
    const idx = groupsData.findIndex(g => g.id === params.id);
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Group not found.' }] },
        { status: 404 },
      );
    }
    groupsData.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/groups/:id/participants', async ({ request, params }) => {
    const body = await request.json() as { user_ids: string[] };
    const membership = groupMemberships[params.id as string];
    if (!membership) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Group not found.' }] },
        { status: 404 },
      );
    }

    const added: string[] = [];
    const skipped: string[] = [];
    for (const uid of body.user_ids) {
      if (membership.participant_ids.includes(uid)) {
        skipped.push(uid);
      } else {
        membership.participant_ids.push(uid);
        added.push(uid);
      }
    }
    const group = groupsData.find(g => g.id === params.id);
    if (group) group.participants_count = membership.participant_ids.length;

    return HttpResponse.json({ data: { added, skipped } }, { status: 201 });
  }),

  http.delete('*/api/v1/groups/:id/participants/:userId', ({ params }) => {
    const membership = groupMemberships[params.id as string];
    if (!membership) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Group not found.' }] },
        { status: 404 },
      );
    }
    membership.participant_ids = membership.participant_ids.filter(uid => uid !== params.userId);
    const group = groupsData.find(g => g.id === params.id);
    if (group) group.participants_count = membership.participant_ids.length;
    return new HttpResponse(null, { status: 204 });
  }),
];
