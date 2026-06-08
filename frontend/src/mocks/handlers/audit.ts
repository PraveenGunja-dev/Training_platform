import { http, HttpResponse } from 'msw';
import { auditData } from '../data/audit';

export const auditHandlers = [
  http.get('*/api/v1/audit', ({ request }) => {
    const url = new URL(request.url);
    const actorId = url.searchParams.get('filter[actor_id]') ?? url.searchParams.get('actor_id');
    const action = url.searchParams.get('filter[action]') ?? url.searchParams.get('action');
    const targetType = url.searchParams.get('filter[target_type]') ?? url.searchParams.get('target_type');
    const from = url.searchParams.get('filter[from]') ?? url.searchParams.get('from');
    const to = url.searchParams.get('filter[to]') ?? url.searchParams.get('to');
    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    let items = [...auditData];
    if (actorId) items = items.filter(e => e.actor?.id === actorId);
    if (action) items = items.filter(e => e.action === action);
    if (targetType) items = items.filter(e => e.target_type === targetType);
    if (from) items = items.filter(e => e.created_at >= from);
    if (to) items = items.filter(e => e.created_at <= to);

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));

    let startIdx = 0;
    if (cursor) {
      const cursorIdx = items.findIndex(e => e.id === cursor);
      if (cursorIdx !== -1) startIdx = cursorIdx + 1;
    }

    const paged = items.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < items.length ? (paged[paged.length - 1]?.id ?? null) : null;

    return HttpResponse.json({ data: paged, meta: { total: items.length, next_cursor: nextCursor } });
  }),
];
