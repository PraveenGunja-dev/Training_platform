import { http, HttpResponse } from 'msw';
import { assignmentsData } from '../data/assignments';
import { groupMemberships } from '../data/groups';
import { mockAuthState } from '../data/seed';
import type { AssignmentTask, LatePolicy } from '@/lib/types';

export const assignmentsHandlers = [
  http.get('*/api/v1/assignments', ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('filter[group_id]') ?? url.searchParams.get('group_id');
    const state = url.searchParams.get('filter[state]') ?? url.searchParams.get('state');
    const latePolicy = url.searchParams.get('filter[late_policy]') ?? url.searchParams.get('late_policy');

    let items = [...assignmentsData];
    if (groupId) items = items.filter(t => t.group_id === groupId);
    if (latePolicy) items = items.filter(t => t.late_policy === latePolicy);
    if (state === 'OPEN') items = items.filter(t => t.is_open);
    if (state === 'CLOSED') items = items.filter(t => !t.is_open && new Date(t.deadline_at) < new Date());
    if (state === 'LOCKED') items = items.filter(t => !t.is_open && new Date(t.upload_open_at) > new Date());

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.get('*/api/v1/me/tasks', ({ request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get('filter[state]') ?? url.searchParams.get('state');

    const userId = mockAuthState.currentUserId;
    const userGroupIds = Object.entries(groupMemberships)
      .filter(([, m]) => m.participant_ids.includes(userId))
      .map(([id]) => id);

    let items = assignmentsData.filter(t => userGroupIds.includes(t.group_id));
    const now = new Date();
    if (state === 'OPEN') items = items.filter(t => t.is_open);
    if (state === 'LOCKED') items = items.filter(t => !t.is_open && new Date(t.upload_open_at) > now);
    if (state === 'CLOSED') items = items.filter(t => !t.is_open && new Date(t.deadline_at) < now);

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.get('*/api/v1/assignments/:id', ({ params }) => {
    const task = assignmentsData.find(t => t.id === params.id);
    return task
      ? HttpResponse.json({ data: task })
      : HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Assignment not found.' }] }, { status: 404 });
  }),

  http.post('*/api/v1/assignments', async ({ request }) => {
    const body = await request.json() as Partial<AssignmentTask> & { group_id: string; upload_open_at: string; deadline_at: string; late_policy: LatePolicy };
    const newTask: AssignmentTask = {
      id: 'task-' + Math.random().toString(36).slice(2, 8),
      group_id: body.group_id, class_id: body.class_id ?? null,
      group_name: body.group_name ?? '',
      class_title: body.class_title ?? null,
      title: body.title ?? '', question: body.question ?? '',
      description: body.description ?? '', instructions: body.instructions ?? '',
      upload_open_at: body.upload_open_at, deadline_at: body.deadline_at,
      late_policy: body.late_policy, reminder_offsets: body.reminder_offsets ?? [60, 30, 10],
      is_open: new Date(body.upload_open_at) <= new Date(),
      is_closed: false,
      question_file_url: body.question_file_url ?? '',
      question_file_name: body.question_file_name ?? '',
      question_file_type: body.question_file_type ?? '',
      question_file_size: body.question_file_size ?? null,
      created_at: new Date().toISOString(),
    };
    assignmentsData.push(newTask);
    return HttpResponse.json({ data: newTask }, { status: 201 });
  }),

  http.patch('*/api/v1/assignments/:id', async ({ request, params }) => {
    const idx = assignmentsData.findIndex(t => t.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Assignment not found.' }] }, { status: 404 });
    const body = await request.json() as Partial<AssignmentTask>;
    assignmentsData[idx] = { ...assignmentsData[idx], ...body };
    return HttpResponse.json({ data: assignmentsData[idx] });
  }),

  http.delete('*/api/v1/assignments/:id', ({ params }) => {
    const idx = assignmentsData.findIndex(t => t.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Assignment not found.' }] }, { status: 404 });
    assignmentsData.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/assignments/:id/close', ({ params }) => {
    const task = assignmentsData.find(t => t.id === params.id);
    if (!task) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Assignment not found.' }] }, { status: 404 });
    task.is_open = false;
    return HttpResponse.json({ data: task });
  }),
];
