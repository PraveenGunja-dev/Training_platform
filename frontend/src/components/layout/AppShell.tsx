import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { RoleGuard } from '@/router/RoleGuard';
import { adminNav, participantNav, instructorNav } from './navConfigs';
import type { NavItem } from './navConfigs';
import { PageTransition } from '@/components/motion/PageTransition';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ForceChangePasswordDialog } from '@/features/auth/ForceChangePasswordDialog';

interface AppShellProps {
  navItems: NavItem[];
}

export function AppShell({ navItems }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <ErrorBoundary>
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
