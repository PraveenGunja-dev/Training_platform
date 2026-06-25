import { http, HttpResponse } from 'msw';
import { submissionsData } from '../data/submissions';
import { assignmentsData } from '../data/assignments';
import { usersData } from '../data/users';
import { mockAuthState } from '../data/seed';
import { notificationsData } from '../data/notifications';
import type { Notification, SaveReviewPayload, Submission, SubmissionReview, SubmissionStatus } from '@/lib/types';

export const submissionsHandlers = [
  http.post('*/api/v1/assignments/:taskId/submissions', async ({ request, params }) => {
    const task = assignmentsData.find(t => t.id === params.taskId);
    if (!task) {
      return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Assignment not found.' }] }, { status: 404 });
    }

    const now = new Date();
    const deadline = new Date(task.deadline_at);
    const uploadOpen = new Date(task.upload_open_at);
    const userId = mockAuthState.currentUserId;

    if (now < uploadOpen) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'assignment.not_open', message: 'Assignment is not open for uploads yet.' }] },
        { status: 422 },
      );
    }

    let status: SubmissionStatus = 'SUBMITTED';
    if (now > deadline) {
      if (task.late_policy === 'STRICT') {
        return HttpResponse.json(
          { data: null, errors: [{ code: 'assignment.deadline_passed_strict', message: 'Deadline has passed (strict policy).' }] },
          { status: 422 },
        );
      }
      if (task.late_policy === 'ADMIN_ONLY') {
        return HttpResponse.json(
          { data: null, errors: [{ code: 'assignment.admin_only', message: 'Only Admin/Manager can submit after deadline.' }] },
          { status: 422 },
        );
      }
      status = 'LATE_SUBMITTED';
    }

    let fileName = 'upload.pdf';
    let fileSize = 100000;
    let fileType = 'application/pdf';
    let note = '';

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart')) {
      try {
        const formData = await request.formData();
        const fileField = formData.get('file');
        if (fileField instanceof File) {
          fileName = fileField.name;
          fileSize = fileField.size;
          fileType = fileField.type || 'application/octet-stream';
        }
        note = (formData.get('note') as string | null) ?? '';
      } catch {
        // fall through with defaults
      }
    }

    // Track version for re-uploads
    const existingSubs = submissionsData.filter(s => s.task_id === params.taskId && s.user_id === userId);
    const maxVersion = existingSubs.reduce((max, s) => Math.max(max, s.version), 0);

    const sub: Submission = {
      id: 'sub-' + Math.random().toString(36).slice(2, 8),
      task_id: params.taskId as string,
      user_id: userId,
      version: maxVersion + 1,
      file_url: `/files/${fileName}`,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      status,
      submitted_at: now.toISOString(),
      submitted_by: userId,
      note,
      review: null,
    };
    submissionsData.push(sub);
    return HttpResponse.json({ data: sub }, { status: 201 });
  }),

  http.get('*/api/v1/assignments/:taskId/submissions', ({ request, params }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('filter[status]') ?? url.searchParams.get('status');
    const search = url.searchParams.get('search')?.toLowerCase();

    let items = submissionsData.filter(s => s.task_id === params.taskId);
    if (status && status !== 'ALL') items = items.filter(s => s.status === status);
    if (search) items = items.filter(s =>
      s.file_name.toLowerCase().includes(search) ||
      s.user_id.toLowerCase().includes(search) ||
      (usersData.find(u => u.id === s.user_id)?.full_name ?? '').toLowerCase().includes(search) ||
      (usersData.find(u => u.id === s.user_id)?.email ?? '').toLowerCase().includes(search),
    );

    const enriched = items.map(s => {
      const user = usersData.find(u => u.id === s.user_id);
      return { ...s, user: user ? { id: user.id, full_name: user.full_name, email: user.email } : undefined };
    });

    return HttpResponse.json({ data: enriched, meta: { total: enriched.length, next_cursor: null } });
  }),

  http.get('*/api/v1/submissions/:id', ({ params }) => {
    const sub = submissionsData.find(s => s.id === params.id);
    return sub
      ? HttpResponse.json({ data: sub })
      : HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Submission not found.' }] }, { status: 404 });
  }),

  http.get('*/api/v1/me/submissions', ({ request }) => {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('filter[task_id]') ?? url.searchParams.get('task_id');
    const sort = url.searchParams.get('sort') ?? '-submitted_at';
    const userId = mockAuthState.currentUserId;

    let items = submissionsData.filter(s => s.user_id === userId);
    if (taskId) items = items.filter(s => s.task_id === taskId);
    if (sort === '-submitted_at') items = [...items].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.get('*/api/v1/assignments/submissions/:submissionId/review', ({ params }) => {
    const sub = submissionsData.find(s => s.id === params.submissionId);
    if (!sub) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'not_found', message: 'Submission not found.' }] },
        { status: 404 },
      );
    }
    return HttpResponse.json({ data: sub.review });
  }),

  http.post('*/api/v1/assignments/submissions/:submissionId/review', async ({ params, request }) => {
    const body = await request.json() as SaveReviewPayload;
    const submissionId = params.submissionId as string;
    const reviewerUser = usersData.find(u => u.id === mockAuthState.currentUserId);

    const subIndex = submissionsData.findIndex(s => s.id === submissionId);
    const isNew = subIndex !== -1 && submissionsData[subIndex].review === null;

    const review: SubmissionReview = {
      id: subIndex !== -1 && submissionsData[subIndex].review ? submissionsData[subIndex].review!.id : Date.now(),
      submission_id: submissionId,
      reviewer_id: mockAuthState.currentUserId,
      reviewer_name: reviewerUser?.full_name ?? 'Reviewer',
      comment: body.comment ?? '',
      grade_numeric: body.grade_numeric ?? null,
      grade_letter: body.grade_letter ?? '',
      reviewed_at: subIndex !== -1 && submissionsData[subIndex].review
        ? submissionsData[subIndex].review!.reviewed_at
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Write back so GET /me/submissions and GET /assignments/:id/submissions reflect the review
    if (subIndex !== -1) {
      submissionsData[subIndex] = { ...submissionsData[subIndex], review };

      // Notify the submission owner (participant) — push into in-memory notifications
      if (isNew) {
        const sub = submissionsData[subIndex];
        const task = assignmentsData.find(t => t.id === sub.task_id);
        const notif: Notification = {
          id: 'notif-review-' + Math.random().toString(36).slice(2, 9),
          user_id: sub.user_id,
          type: 'SUBMISSION_REVIEWED',
          channel: 'IN_APP',
          title: 'Your submission has been reviewed',
          body: `Your submission${task ? ` for "${task.title}"` : ''} has been reviewed.`,
          link: `/me/tasks/${sub.task_id}`,
          read_at: null,
          created_at: new Date().toISOString(),
        };
        notificationsData.push(notif);
      }
    }

    return HttpResponse.json({ data: review }, { status: isNew ? 201 : 200 });
  }),
];
