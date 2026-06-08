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

const VALID_ROLES: Role[] = ['ADMIN', 'INSTRUCTOR', 'PARTICIPANT'];

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
            INSTRUCTOR: {
              id: 'u-instructor',
              email: 'dev-instructor@example.com',
              full_name: 'Dev Instructor',
              role: 'INSTRUCTOR',
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
          };
          set({ user: mockUsers[role], accessToken: 'mock-access-token' });
        }
      },
    }),
    {
      name: 'ems-auth',
      version: 2,
      // v0→v1: MANAGER role removed, converted to ADMIN.
      // v1→v2: INSTRUCTOR role added; unknown roles force re-login.
      migrate: (persisted: unknown) => {
        const s = persisted as { user?: { role?: string } | null; accessToken?: string | null } | null;
        if (!s) return {};
        if (s.user?.role === 'MANAGER') {
          return { ...s, user: { ...s.user, role: 'ADMIN' as Role } };
        }
        if (s.user?.role && !(VALID_ROLES as string[]).includes(s.user.role)) {
          return { user: null, accessToken: null };
        }
        return s;
      },
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
