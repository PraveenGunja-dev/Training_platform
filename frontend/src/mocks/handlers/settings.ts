import { http, HttpResponse } from 'msw';
import { settingsMockData } from '../data/settings';

export const settingsHandlers = [
  http.get('*/api/v1/admin/settings', () => {
    return HttpResponse.json({ data: { ...settingsMockData } });
  }),

  http.patch('*/api/v1/admin/settings', async ({ request }) => {
    const body = await request.json() as Partial<typeof settingsMockData>;
    Object.assign(settingsMockData, body);
    return HttpResponse.json({ data: { ...settingsMockData } });
  }),

  http.post('*/api/v1/admin/settings/force-logout', () => {
    return HttpResponse.json({ data: { cleared: 12 } });
  }),
];
