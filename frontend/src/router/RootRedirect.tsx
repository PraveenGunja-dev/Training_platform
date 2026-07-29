import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import type { Role } from '@/lib/types';

const paths: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  SUB_MENTOR: '/sub-mentor/dashboard',
  PARTICIPANT: '/me/dashboard',
  LEAD_MENTOR: '/lead-mentor/dashboard',
};

export function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'LEAD_MENTOR') return <Navigate to="/lead-mentor/dashboard" replace />;
  const path = paths[user.role];
  if (!path) {
    // Unknown role (e.g. stale localStorage value) — clear state and force re-login.
    logout();
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={path} replace />;
}
