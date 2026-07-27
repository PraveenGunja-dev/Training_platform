import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, put, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get, post, put, delete: del } }));

import { groupsApi } from '@/api/groups';
import { usersApi } from '@/api/users';
import { dashboardApi } from '@/api/dashboard';

describe('canonical role adapter paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { data: [] } });
    post.mockResolvedValue({ data: { data: {} } });
    put.mockResolvedValue({ data: { data: {} } });
  });

  it('uses canonical Sub-Mentor group and user paths', async () => {
    await groupsApi.getSubMentors('group-1');
    await groupsApi.availableSubMentors('group-1', 'name');
    await usersApi.listSubMentors('name');
    expect(get).toHaveBeenNthCalledWith(1, '/groups/group-1/sub-mentors');
    expect(get).toHaveBeenNthCalledWith(2, '/groups/group-1/available-sub-mentors?search=name');
    expect(get).toHaveBeenNthCalledWith(3, '/sub-mentors', { params: { q: 'name' } });
  });

  it('uses canonical Lead Mentor paths', async () => {
    await groupsApi.getLeadMentor('group-1');
    await groupsApi.assignLeadMentor('group-1', 'user-1');
    await dashboardApi.leadMentor();
    expect(get).toHaveBeenNthCalledWith(1, '/groups/group-1/lead-mentor');
    expect(put).toHaveBeenCalledWith('/groups/group-1/lead-mentor', { user_id: 'user-1' });
    expect(get).toHaveBeenNthCalledWith(2, '/dashboard/lead-mentor');
  });
});