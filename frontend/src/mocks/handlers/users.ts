import { http, HttpResponse } from 'msw';
import { usersData } from '../data/users';
import type { User } from '@/lib/types';

export const usersHandlers = [
  http.get('*/api/v1/users', ({ request }) => {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') ?? url.searchParams.get('filter[role]');
    const status = url.searchParams.get('status') ?? url.searchParams.get('filter[status]');
    const search = url.searchParams.get('search')?.toLowerCase();
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const page_size = parseInt(url.searchParams.get('page_size') ?? '20', 10);

    let items = [...usersData];
    if (role) items = items.filter(u => u.role === role);
    if (status === 'active') items = items.filter(u => u.is_active);
    if (status === 'deactivated') items = items.filter(u => !u.is_active);
    if (search) items = items.filter(u =>
      u.full_name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
    );

    const total = items.length;
    const start = (page - 1) * page_size;
    const paged = items.slice(start, start + page_size);

    return HttpResponse.json({ data: paged, meta: { page, page_size, total } });
  }),

  http.get('*/api/v1/users/:id', ({ params }) => {
    const user = usersData.find(u => u.id === params.id);
    return user
      ? HttpResponse.json({ data: user })
      : HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'User not found.' }] }, { status: 404 });
  }),

  http.post('*/api/v1/users/bulk-invite', async ({ request }) => {
    const body = await request.json() as { rows: Array<{ email: string; role: string }> };
    const created: User[] = [];
    const skipped: string[] = [];
    for (const row of body.rows) {
      if (usersData.some(u => u.email === row.email)) {
        skipped.push(row.email);
      } else {
        const u: User = {
          id: 'u-' + Math.random().toString(36).slice(2, 8),
          email: row.email, full_name: '', role: row.role as User['role'],
          photo_url: null, is_active: false, created_at: new Date().toISOString(),
        };
        usersData.push(u);
        created.push(u);
      }
    }
    return HttpResponse.json({ data: { created: created.length, skipped: skipped.length, errors: [] } }, { status: 201 });
  }),

  http.post('*/api/v1/users', async ({ request }) => {
    const body = await request.json() as { email: string; role: string; full_name?: string; group_ids?: string[] };
    if (usersData.some(u => u.email === body.email)) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'user.email_exists', message: 'Email already registered.' }] },
        { status: 409 },
      );
    }
    const newUser: User = {
      id: 'u-' + Math.random().toString(36).slice(2, 8),
      email: body.email,
      full_name: body.full_name ?? '',
      role: body.role as User['role'],
      photo_url: null,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    usersData.push(newUser);
    return HttpResponse.json({ data: newUser }, { status: 201 });
  }),

  http.patch('*/api/v1/users/:id', async ({ request, params }) => {
    const idx = usersData.findIndex(u => u.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'User not found.' }] }, { status: 404 });
    }
    const body = await request.json() as Partial<User>;
    usersData[idx] = { ...usersData[idx], ...body };
    return HttpResponse.json({ data: usersData[idx] });
  }),

  http.delete('*/api/v1/users/:id', ({ params }) => {
    const idx = usersData.findIndex(u => u.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'User not found.' }] }, { status: 404 });
    }
    usersData.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/users/:id/resend-invite', ({ params }) => {
    const user = usersData.find(u => u.id === params.id);
    return user
      ? new HttpResponse(null, { status: 202 })
      : HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'User not found.' }] }, { status: 404 });
  }),
];
