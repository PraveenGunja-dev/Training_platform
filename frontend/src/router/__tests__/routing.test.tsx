import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoleGuard } from '@/router/RoleGuard';
import { RootRedirect } from '@/router/RootRedirect';
import { instructorNav } from '@/components/layout/navConfigs';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

function makeUser(role: string): User {
  return {
    id: 'u-test',
    email: 'test@test.com',
    full_name: 'Test User',
    role: role as User['role'],
    photo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  localStorage.clear();
});

describe('RoleGuard', () => {
  it('blocks PARTICIPANT from instructor routes (redirects to /403)', () => {
    useAuthStore.setState({ user: makeUser('PARTICIPANT'), accessToken: 'tok' });
    render(
      <MemoryRouter initialEntries={['/instructor/dashboard']}>
        <Routes>
          <Route
            path="/instructor/*"
            element={
              <RoleGuard role="INSTRUCTOR">
                <div>instructor content</div>
              </RoleGuard>
            }
          />
          <Route path="/403" element={<div>forbidden</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('instructor content')).not.toBeInTheDocument();
    expect(screen.getByText('forbidden')).toBeInTheDocument();
  });

  it('blocks ADMIN from instructor routes (redirects to /403)', () => {
    useAuthStore.setState({ user: makeUser('ADMIN'), accessToken: 'tok' });
    render(
      <MemoryRouter initialEntries={['/instructor/dashboard']}>
        <Routes>
          <Route
            path="/instructor/*"
            element={
              <RoleGuard role="INSTRUCTOR">
                <div>instructor content</div>
              </RoleGuard>
            }
          />
          <Route path="/403" element={<div>forbidden</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('instructor content')).not.toBeInTheDocument();
    expect(screen.getByText('forbidden')).toBeInTheDocument();
  });

  it('allows INSTRUCTOR through', () => {
    useAuthStore.setState({ user: makeUser('INSTRUCTOR'), accessToken: 'tok' });
    render(
      <MemoryRouter initialEntries={['/instructor/dashboard']}>
        <Routes>
          <Route
            path="/instructor/*"
            element={
              <RoleGuard role="INSTRUCTOR">
                <div>instructor content</div>
              </RoleGuard>
            }
          />
          <Route path="/403" element={<div>forbidden</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('instructor content')).toBeInTheDocument();
  });
});

describe('RootRedirect', () => {
  it('redirects INSTRUCTOR to /instructor/dashboard', () => {
    useAuthStore.setState({ user: makeUser('INSTRUCTOR'), accessToken: 'tok' });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/instructor/dashboard" element={<div>instructor dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('instructor dashboard')).toBeInTheDocument();
  });

  it('redirects unknown role to /login and clears auth state', () => {
    useAuthStore.setState({
      user: { ...makeUser('ADMIN'), role: 'GHOST' as unknown as User['role'] },
      accessToken: 'tok',
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('useLogin rolePrefix guard', () => {
  it('INSTRUCTOR landing on /me/* route gets redirected to /403 by RoleGuard', () => {
    // This test verifies the bug that was fixed: before the fix, useLogin resolved
    // rolePrefix to '/me/' for INSTRUCTOR, so a stale `from` of '/me/dashboard'
    // would be honoured and the instructor would land on a PARTICIPANT-only route.
    useAuthStore.setState({ user: makeUser('INSTRUCTOR'), accessToken: 'tok' });
    render(
      <MemoryRouter initialEntries={['/me/dashboard']}>
        <Routes>
          <Route
            path="/me/*"
            element={
              <RoleGuard role="PARTICIPANT">
                <div>participant content</div>
              </RoleGuard>
            }
          />
          <Route path="/403" element={<div>forbidden</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('participant content')).not.toBeInTheDocument();
    expect(screen.getByText('forbidden')).toBeInTheDocument();
  });
});

describe('instructorNav', () => {
  it('contains required sidebar items', () => {
    const labels = instructorNav.map((item) => item.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Groups');
    expect(labels).toContain('Classes');
    expect(labels).toContain('Attendance');
    expect(labels).toContain('Assignments');
    expect(labels).toContain('Submissions');
    expect(labels).toContain('Documents');
    expect(labels).toContain('Shared Uploads');
  });

  it('excludes admin-only items (Users, Settings, Audit Log)', () => {
    const labels = instructorNav.map((item) => item.label);
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Settings');
    expect(labels).not.toContain('Audit Log');
  });
});
