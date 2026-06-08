import { http, HttpResponse } from 'msw';
import { usersData } from '../data/users';
import { mockAuthState } from '../data/seed';

const MOCK_PASSWORD = 'password123';

export const authHandlers = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    const user = usersData.find(u => u.email === body.email);
    if (!user || body.password !== MOCK_PASSWORD) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'auth.invalid_credentials', message: 'Invalid email or password.' }] },
        { status: 401 },
      );
    }
    mockAuthState.currentUserId = user.id;
    return HttpResponse.json({ data: { access: 'mock-access-token', user } });
  }),

  http.post('*/api/v1/auth/refresh', () =>
    HttpResponse.json({ data: { access: 'mock-access-token' } }),
  ),

  http.post('*/api/v1/auth/logout', () => {
    mockAuthState.currentUserId = 'u-admin';
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/auth/set-password', async ({ request }) => {
    const body = await request.json() as { token: string; password: string };
    if (!body.token) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'auth.token_invalid', message: 'Invalid or missing token.' }] },
        { status: 400 },
      );
    }
    // Any token succeeds in mock — log in as admin
    const user = usersData.find(u => u.id === 'u-admin')!;
    mockAuthState.currentUserId = user.id;
    return HttpResponse.json({ data: { access: 'mock-access-token', user } });
  }),

  http.get('*/api/v1/auth/me', () => {
    const user =
      usersData.find(u => u.id === mockAuthState.currentUserId) ??
      usersData.find(u => u.role === 'ADMIN')!;
    return HttpResponse.json({ data: user });
  }),

  http.patch('*/api/v1/me', async ({ request }) => {
    const body = await request.json() as { full_name?: string; photo_url?: string };
    const idx = usersData.findIndex(u => u.id === mockAuthState.currentUserId);
    if (idx === -1) {
      return HttpResponse.json(
        { data: null, errors: [{ code: 'auth.invalid', message: 'User not found.' }] },
        { status: 401 },
      );
    }
    if (body.full_name !== undefined) usersData[idx].full_name = body.full_name;
    if (body.photo_url !== undefined) usersData[idx].photo_url = body.photo_url;
    return HttpResponse.json({ data: usersData[idx] });
  }),

  http.post('*/api/v1/me/password', () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
