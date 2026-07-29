import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@/lib/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  mockLogin: (role: Role) => void;
}


export function migrateAuthState(persisted: unknown): { user?: User | null } {
  const state = persisted as {
    user?: (Record<string, unknown> & { role?: string }) | null;
    accessToken?: unknown;
  } | null;
  if (!state?.user) return {};

  const roleMap: Record<string, Role> = {
    MANAGER: 'ADMIN',
    GROUP_ADMIN: 'LEAD_MENTOR',
    INSTRUCTOR: 'SUB_MENTOR',
    ADMIN: 'ADMIN',
    LEAD_MENTOR: 'LEAD_MENTOR',
    SUB_MENTOR: 'SUB_MENTOR',
    PARTICIPANT: 'PARTICIPANT',
  };
  const role = state.user.role ? roleMap[state.user.role] : undefined;
  if (!role) return { user: null };

  const { admin_of_group_ids, accessToken: _dropped, ...user } = state.user;
  return {
    user: {
      ...user,
      role,
      ...(admin_of_group_ids === undefined
        ? {}
        : { lead_mentor_of_group_ids: admin_of_group_ids }),
    } as User,
  };
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, token) => set({ user, accessToken: token }),
      logout: () => set({ user: null, accessToken: null }),
      mockLogin: (role) => {
        if (import.meta.env.DEV) {
          const mockUsers: Record<Role, User> = {
            ADMIN: {
              id: 'u-admin',
              email: 'kiran.kr@adani.com',
              full_name: 'Kiran K R',
              role: 'ADMIN',
              photo_url: null,
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              business_unit: 'Adani Group Corporate',
              department: 'HR & Talent Development',
              grade_code: 'M5',
              employee_code: 'AGC-HR-0007',
            },
            SUB_MENTOR: {
              id: 'u-subMentor',
              email: 'dev-sub-mentor@example.com',
              full_name: 'Dev Sub-Mentor',
              role: 'SUB_MENTOR',
              photo_url: null,
              is_active: true,
              created_at: '2026-01-15T00:00:00Z',
              business_unit: 'Adani Green Energy',
              department: 'Learning & Development',
              grade_code: 'L3',
              employee_code: 'AGEL-INS-0042',
            },
            PARTICIPANT: {
              id: 'u-part',
              email: 'rutvik.prajapati@adani.com',
              full_name: 'Rutvik Prajapati',
              role: 'PARTICIPANT',
              photo_url: null,
              is_active: true,
              created_at: '2026-02-05T00:00:00Z',
              business_unit: 'Adani Enterprises',
              department: 'Engineering',
              grade_code: 'E2',
              employee_code: 'AEL-ENG-1197',
            },
            LEAD_MENTOR: {
              id: 'u-lead-mentor',
              email: 'lead-mentor@example.com',
              full_name: 'Dev Lead Mentor',
              role: 'LEAD_MENTOR',
              lead_mentor_of_group_ids: ['g-00000000-0000-0000-0000-000000000001'],
              photo_url: null,
              is_active: true,
              created_at: '2026-01-15T00:00:00Z',
              business_unit: 'Adani Green Energy',
              department: 'Learning & Development',
              grade_code: 'L3',
              employee_code: 'AGEL-INS-0099',
            },
          };
          set({ user: mockUsers[role], accessToken: 'mock-access-token' });
        }
      },
    }),
    {
      name: 'ems-auth',
      version: 4,
      migrate: migrateAuthState,
      partialize: (state) => ({ user: state.user }),
    }
  )
);
