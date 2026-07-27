import { describe, expect, it } from 'vitest';
import { migrateAuthState } from '@/store/auth';

const legacyUser = (role: string) => ({
  id: 'user-1', email: 'user@example.com', full_name: 'User', role,
  photo_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z',
});

describe('auth persistence migration', () => {
  it.each([
    ['MANAGER', 'ADMIN'],
    ['GROUP_ADMIN', 'LEAD_MENTOR'],
    ['INSTRUCTOR', 'SUB_MENTOR'],
  ])('migrates %s to %s and drops the persisted token', (legacyRole, role) => {
    const migrated = migrateAuthState({
      user: { ...legacyUser(legacyRole), admin_of_group_ids: ['group-1'] },
      accessToken: 'stale-token',
    });
    expect(migrated.user).toMatchObject({ role });
    expect(migrated.user).not.toHaveProperty('admin_of_group_ids');
    expect(migrated.user).toHaveProperty('lead_mentor_of_group_ids', ['group-1']);
    expect(migrated).not.toHaveProperty('accessToken');
  });

  it('clears unknown persisted roles', () => {
    expect(migrateAuthState({ user: legacyUser('UNKNOWN') })).toEqual({ user: null });
  });
});