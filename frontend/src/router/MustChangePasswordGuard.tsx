import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export function MustChangePasswordGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();

  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}
