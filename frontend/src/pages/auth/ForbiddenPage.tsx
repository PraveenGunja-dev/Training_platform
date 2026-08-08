import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/auth';
import type { Role } from '@/lib/types';

function dashboardPath(role: Role): string {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'LEAD_MENTOR') return '/lead-mentor/dashboard';
  if (role === 'SUB_MENTOR') return '/sub-mentor/dashboard';
  return '/me/dashboard';
}

export function ForbiddenPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const handleLogout = async () => {
    await authApi.logout();
    queryClient.clear();
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-7xl font-bold text-white/10 mb-4">403</p>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Access Forbidden</h1>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have permission to view this page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
          {user && (
            <Button onClick={() => navigate(dashboardPath(user.role))}>
              Go to Dashboard
            </Button>
          )}
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
