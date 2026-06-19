import { ForceChangePasswordDialog } from '@/features/auth/ForceChangePasswordDialog';
import { useAuthStore } from '@/store/auth';
import { Navigate } from 'react-router-dom';

export function ForceChangePasswordPage() {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to="/" replace />;
  // Render the dialog directly as a full-page overlay (dialog already renders itself)
  return <ForceChangePasswordDialog />;
}
