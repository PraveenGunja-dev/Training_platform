import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import type { Role } from '@/lib/types';

const paths: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  INSTRUCTOR: '/instructor/dashboard',
  PARTICIPANT: '/me/dashboard',
  GROUP_ADMIN: '/group-admin/dashboard',
};

export function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'GROUP_ADMIN') return <Navigate to="/group-admin/dashboard" replace />;
  const path = paths[user.role];
  if (!path) {
    // Unknown role (e.g. stale localStorage value) — clear state and force re-login.
    logout();
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={path} replace />;
}
