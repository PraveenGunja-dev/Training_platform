import { http, HttpResponse } from 'msw';
import { notificationsData } from '../data/notifications';
import { mockAuthState } from '../data/seed';

export const notificationsHandlers = [
  http.get('*/api/v1/notifications', ({ request }) => {
    const userId = mockAuthState.currentUserId;
    const url = new URL(request.url);
    const unreadOnly =
      url.searchParams.get('unread_only') === 'true' ||
      url.searchParams.get('filter[unread_only]') === 'true';
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const cursor = url.searchParams.get('cursor');

    let items = notificationsData.filter(n => n.user_id === userId);
    if (unreadOnly) items = items.filter(n => !n.read_at);

    const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));

    let startIdx = 0;
    if (cursor) {
      const cursorIdx = sorted.findIndex(n => n.id === cursor);
      startIdx = cursorIdx >= 0 ? cursorIdx + 1 : 0;
    }

    const paged = sorted.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < sorted.length ? (paged[paged.length - 1]?.id ?? null) : null;

    return HttpResponse.json({
      data: paged,
      meta: { next_cursor: nextCursor },
    });
  }),

  http.get('*/api/v1/notifications/unread-count', () => {
    const userId = mockAuthState.currentUserId;
    const unreadCount = notificationsData.filter(n => n.user_id === userId && !n.read_at).length;
    return HttpResponse.json({ data: { unread_count: unreadCount } });
  }),

  http.post('*/api/v1/notifications/:id/read', ({ params }) => {
    const notif = notificationsData.find(n => n.id === params.id);
    if (!notif) return new HttpResponse(null, { status: 404 });
    notif.read_at = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/notifications/read-all', () => {
    const userId = mockAuthState.currentUserId;
    notificationsData
      .filter(n => n.user_id === userId && !n.read_at)
      .forEach(n => {
        n.read_at = new Date().toISOString();
      });
    return new HttpResponse(null, { status: 204 });
  }),
];
