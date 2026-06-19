import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { RoleGuard } from '@/router/RoleGuard';
import { adminNav, participantNav, instructorNav, groupAdminNav } from './navConfigs';
import type { NavItem } from './navConfigs';
import { PageTransition } from '@/components/motion/PageTransition';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ForceChangePasswordDialog } from '@/features/auth/ForceChangePasswordDialog';
import { useAuthStore } from '@/store/auth';
import { isGroupAdmin } from '@/lib/types';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';

interface AppShellProps {
  navItems: NavItem[];
}

export function AppShell({ navItems }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Topbar onMenuClick={() => setMobileOpen(true)} />
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navItems={navItems}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar navItems={navItems} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto" id="main-content">
          <ErrorBoundary key={location.pathname}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>

      <ForceChangePasswordDialog />
    </div>
  );
}

export function AdminLayout() {
  return (
    <RoleGuard role="ADMIN">
      <AppShell navItems={adminNav} />
    </RoleGuard>
  );
}

export function ParticipantLayout() {
  return (
    <RoleGuard role="PARTICIPANT">
      <AppShell navItems={participantNav} />
    </RoleGuard>
  );
}

export function InstructorLayout() {
  return (
    <RoleGuard role="INSTRUCTOR">
      <AppShell navItems={instructorNav} />
    </RoleGuard>
  );
}

function GroupAdminNoGroupPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = user
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleLogout = async () => {
    await authApi.logout();
    queryClient.clear();
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal topbar */}
      <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
        <span className="text-sm font-semibold text-foreground">ACLP Training Management</span>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        </div>
      </header>

      {/* Centered message */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">No Batch Assigned</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account has not been allocated to any batch or group yet.
              Please contact your Super Admin to get access.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GroupAdminLayout() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'GROUP_ADMIN') return <Navigate to="/403" replace />;
  if (!isGroupAdmin(user)) return <GroupAdminNoGroupPage />;
  return <AppShell navItems={groupAdminNav} />;
}
