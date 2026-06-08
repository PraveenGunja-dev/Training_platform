/**
 * Chunk 5 — Instructor read-view smoke tests
 *
 * Strategy:
 *   - mock @tanstack/react-query so no real HTTP calls happen
 *   - mock heavy feature components that pull in Recharts / FullCalendar
 *   - set auth store state to INSTRUCTOR before each test
 *   - assert that the page renders without crashing, shows expected copy,
 *     and does NOT render write-action buttons (Create / Schedule / Publish / Upload)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function makeInstructor(): User {
  return {
    id: 'inst-1',
    email: 'instructor@test.com',
    full_name: 'Test Instructor',
    role: 'INSTRUCTOR',
    photo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function makeAdmin(): User {
  return {
    id: 'admin-1',
    email: 'admin@test.com',
    full_name: 'Test Admin',
    role: 'ADMIN',
    photo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(ui: React.ReactElement, initialEntries?: string[]) {
  const qc = makeQc();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries ?? ['/']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function hookWrapper() {
  const qc = makeQc();
  return function Wrap({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

/* ──────────────────────────────────────────────
   Module mocks — heavy feature components
   ────────────────────────────────────────────── */

// Mock Recharts-based chart components to avoid canvas errors in jsdom
vi.mock('@/features/charts/AttendancePieChart', () => ({
  AttendancePieChart: () => <div data-testid="attendance-pie-chart" />,
}));
vi.mock('@/features/charts/SubmissionBarChart', () => ({
  SubmissionBarChart: () => <div data-testid="submission-bar-chart" />,
}));
vi.mock('@/features/charts/ChartContainer', () => ({
  ChartContainer: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="chart-container">
      <span>{title}</span>
      {children}
    </div>
  ),
}));
vi.mock('@/features/admin/dashboard/GroupComparisonChart', () => ({
  GroupComparisonChart: () => <div data-testid="group-comparison-chart" />,
}));
vi.mock('@/features/admin/dashboard/DailyUploadTrendChart', () => ({
  DailyUploadTrendChart: () => <div data-testid="daily-upload-trend-chart" />,
}));
vi.mock('@/features/admin/dashboard/DeadlineTrackingChart', () => ({
  DeadlineTrackingChart: () => <div data-testid="deadline-tracking-chart" />,
}));
vi.mock('@/features/admin/dashboard/WeeklyTrendChart', () => ({
  WeeklyTrendChart: () => <div data-testid="weekly-trend-chart" />,
}));
vi.mock('@/features/admin/dashboard/ClassStatusChart', () => ({
  ClassStatusChart: () => <div data-testid="class-status-chart" />,
}));
vi.mock('@/features/admin/dashboard/ParticipantActivityTable', () => ({
  ParticipantActivityTable: () => <div data-testid="participant-activity-table" />,
}));
vi.mock('@/features/charts/KpiCard', () => ({
  KpiCard: ({ label, value }: { label: string; value: number }) => (
    <div data-testid="kpi-card">{label}: {value}</div>
  ),
}));
vi.mock('@/features/group-detail/GroupHeader', () => ({
  GroupHeader: ({ group }: { group: { name: string } }) => (
    <div data-testid="group-header">{group.name}</div>
  ),
}));
vi.mock('@/features/group-detail/GroupTabs', () => ({
  GroupTabs: ({ group }: { group: { id: string } }) => (
    <div data-testid="group-tabs">Tabs for {group.id}</div>
  ),
}));
vi.mock('@/features/admin/attendance/ClassAttendancePanel', () => ({
  ClassAttendancePanel: () => <div data-testid="class-attendance-panel" />,
}));
vi.mock('@/features/admin/class/ClassSubmissionsPanel', () => ({
  ClassSubmissionsPanel: () => <div data-testid="class-submissions-panel" />,
}));
vi.mock('@/features/participant/class/RelatedTasksCard', () => ({
  RelatedTasksCard: () => <div data-testid="related-tasks-card" />,
}));
vi.mock('@/features/admin/shared-uploads/ApprovalQueueTable', () => ({
  ApprovalQueueTable: () => <div data-testid="approval-queue-table" />,
}));
vi.mock('@/features/admin/attendance/SessionsTable', () => ({
  SessionsTable: ({ filter }: { filter: string }) => (
    <div data-testid={`sessions-table-${filter.toLowerCase()}`}>Sessions: {filter}</div>
  ),
}));

// Mock StaggerContainer / StaggerItem (motion wrappers)
vi.mock('@/components/motion/StaggerContainer', () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/motion/StaggerItem', () => ({
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ──────────────────────────────────────────────
   react-query mock — controlled per test
   ────────────────────────────────────────────── */

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    }),
    useInfiniteQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    }),
    useMutation: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

/* shorthand — returns the mocked useQuery function */
async function getMockedUseQuery() {
  const { useQuery } = await import('@tanstack/react-query');
  return vi.mocked(useQuery);
}

/* typed helper for mock return values — avoids cast noise in each test */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qResult(val: object): any { return val; }

const emptyListResult = qResult({ data: { data: [] }, isLoading: false, isError: false, refetch: vi.fn() });

/* ─────────────────────────────────────────────────────────────────────────
   Reset state before every test
   ───────────────────────────────────────────────────────────────────────── */

beforeEach(async () => {
  useAuthStore.setState({ user: null, accessToken: null });
  vi.clearAllMocks();
  // Default: all useQuery calls return loading state
  const { useQuery } = await import('@tanstack/react-query');
  vi.mocked(useQuery).mockReturnValue(qResult({
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  }));
});

/* ═══════════════════════════════════════════════════════════════════════════
   useCan hook tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('useCan hook', () => {
  it('returns false for INSTRUCTOR on edit + class', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const { useCan } = await import('@/hooks/useCan');
    const { result } = renderHook(() => useCan('edit', 'class'), { wrapper: hookWrapper() });
    expect(result.current).toBe(false);
  });

  it('returns false for INSTRUCTOR on create + group', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const { useCan } = await import('@/hooks/useCan');
    const { result } = renderHook(() => useCan('create', 'group'), { wrapper: hookWrapper() });
    expect(result.current).toBe(false);
  });

  it('returns true for ADMIN on edit + class', async () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    const { useCan } = await import('@/hooks/useCan');
    const { result } = renderHook(() => useCan('edit', 'class'), { wrapper: hookWrapper() });
    expect(result.current).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorDashboardPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorDashboardPage', () => {
  it('renders skeleton/loading state without crashing when isLoading=true', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }));

    const { default: InstructorDashboardPage } = await import('@/pages/instructor/DashboardPage');
    const { container } = render(wrapper(<InstructorDashboardPage />));
    // Should render the skeleton (animate-pulse wrapper) not KPI cards
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-card')).not.toBeInTheDocument();
  });

  it('shows empty-state with no-groups copy when myGroups returns empty array', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery
      .mockReturnValueOnce(qResult({ data: { data: {} }, isLoading: false, isError: false, refetch: vi.fn() }))
      .mockReturnValueOnce(qResult({ data: { data: [] }, isLoading: false, isError: false, refetch: vi.fn() }));

    const { default: InstructorDashboardPage } = await import('@/pages/instructor/DashboardPage');
    render(wrapper(<InstructorDashboardPage />));
    expect(screen.getByText('No groups assigned')).toBeInTheDocument();
  });

  it('shows assigned-groups subtitle when 2 groups are assigned', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();

    const fullKpis = {
      total_participants: 10,
      total_groups: 2,
      classes_today: 1,
      classes_upcoming: 3,
      classes_completed: 5,
      submitted: 8,
      pending: 2,
      late: 1,
      video_uploads: 0,
      doc_uploads: 0,
      pending_approvals: 0,
    };
    const fullCharts = {
      attendance_pie: [],
      submission_bar: [],
      group_comparison: [],
      daily_upload_trend: [],
      deadline_tracking: [],
      class_status: [],
      weekly_trend: [],
    };

    useQuery
      .mockReturnValueOnce(qResult({
        data: {
          data: {
            kpis: fullKpis,
            charts: fullCharts,
            recent_documents: [],
            recent_activity: [],
            participant_activity: [],
          },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }))
      .mockReturnValueOnce(qResult({
        data: {
          data: [
            { id: 'g1', name: 'Group A', participant_count: 5 },
            { id: 'g2', name: 'Group B', participant_count: 3 },
          ],
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }));

    const { default: InstructorDashboardPage } = await import('@/pages/instructor/DashboardPage');
    render(wrapper(<InstructorDashboardPage />));
    expect(screen.getByText('Showing data for your 2 assigned groups.')).toBeInTheDocument();
  });

  it('renders without crashing even when chart data is empty arrays', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();

    const fullKpis = {
      total_participants: 0,
      total_groups: 1,
      classes_today: 0,
      classes_upcoming: 0,
      classes_completed: 0,
      submitted: 0,
      pending: 0,
      late: 0,
      video_uploads: 0,
      doc_uploads: 0,
      pending_approvals: 0,
    };
    const emptyCharts = {
      attendance_pie: [],
      submission_bar: [],
      group_comparison: [],
      daily_upload_trend: [],
      deadline_tracking: [],
      class_status: [],
      weekly_trend: [],
    };

    useQuery
      .mockReturnValueOnce(qResult({
        data: {
          data: {
            kpis: fullKpis,
            charts: emptyCharts,
            recent_documents: [],
            recent_activity: [],
            participant_activity: [],
          },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }))
      .mockReturnValueOnce(qResult({
        data: { data: [{ id: 'g1', name: 'Solo', participant_count: 1 }] },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }));

    const { default: InstructorDashboardPage } = await import('@/pages/instructor/DashboardPage');
    const { container } = render(wrapper(<InstructorDashboardPage />));
    expect(container).toBeTruthy();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorGroupsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorGroupsPage', () => {
  it('renders empty state "No groups assigned yet" when query returns empty array', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorGroupsPage } = await import('@/pages/instructor/GroupsPage');
    render(wrapper(<InstructorGroupsPage />));
    expect(screen.getByText(/No groups assigned yet/i)).toBeInTheDocument();
  });

  it('renders group cards with group names when data is returned', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: [{ id: 'g1', name: 'Alpha Group', participant_count: 10 }] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    const { default: InstructorGroupsPage } = await import('@/pages/instructor/GroupsPage');
    render(wrapper(<InstructorGroupsPage />));
    expect(screen.getByText('Alpha Group')).toBeInTheDocument();
  });

  it('does NOT render a "New Group" button', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorGroupsPage } = await import('@/pages/instructor/GroupsPage');
    render(wrapper(<InstructorGroupsPage />));
    expect(screen.queryByText('New Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Group')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorGroupDetailPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorGroupDetailPage', () => {
  const mockGroupDetail = {
    id: 'g1',
    name: 'Beta Group',
    description: 'A test group',
    is_archived: false,
    participants_count: 5,
    participants: [],
    instructors: [],
  };

  it('renders "Assigned Groups" back button text', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: mockGroupDetail },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));

    const { default: InstructorGroupDetailPage } = await import('@/pages/instructor/GroupDetailPage');
    render(
      <QueryClientProvider client={makeQc()}>
        <MemoryRouter initialEntries={['/instructor/groups/g1']}>
          <Routes>
            <Route path="/instructor/groups/:id" element={<InstructorGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Assigned Groups')).toBeInTheDocument();
  });

  it('renders GroupHeader with the group name', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: mockGroupDetail },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));

    const { default: InstructorGroupDetailPage } = await import('@/pages/instructor/GroupDetailPage');
    render(
      <QueryClientProvider client={makeQc()}>
        <MemoryRouter initialEntries={['/instructor/groups/g1']}>
          <Routes>
            <Route path="/instructor/groups/:id" element={<InstructorGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('group-header')).toBeInTheDocument();
    expect(screen.getByText('Beta Group')).toBeInTheDocument();
  });

  it('does NOT render an "Add Participants" button', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: mockGroupDetail },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));

    const { default: InstructorGroupDetailPage } = await import('@/pages/instructor/GroupDetailPage');
    render(
      <QueryClientProvider client={makeQc()}>
        <MemoryRouter initialEntries={['/instructor/groups/g1']}>
          <Routes>
            <Route path="/instructor/groups/:id" element={<InstructorGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.queryByText('Add Participants')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage Instructors')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorClassesPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorClassesPage', () => {
  it('does NOT render a "Schedule Class" button', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorClassesPage } = await import('@/pages/instructor/ClassesPage');
    render(wrapper(<InstructorClassesPage />));
    // No button with "Schedule" text should exist
    expect(screen.queryByRole('button', { name: /schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/schedule class/i)).not.toBeInTheDocument();
  });

  it('renders empty state "No classes found" when classes list is empty', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    const { default: InstructorClassesPage } = await import('@/pages/instructor/ClassesPage');
    render(wrapper(<InstructorClassesPage />));
    expect(screen.getByText('No classes found.')).toBeInTheDocument();
  });

  it('renders "Classes" page heading', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorClassesPage } = await import('@/pages/instructor/ClassesPage');
    render(wrapper(<InstructorClassesPage />));
    expect(screen.getByText('Classes')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorAssignmentsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorAssignmentsPage', () => {
  it('does NOT render "Create Assignment" button', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorAssignmentsPage } = await import('@/pages/instructor/AssignmentsPage');
    render(wrapper(<InstructorAssignmentsPage />));
    expect(screen.queryByText(/create assignment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new assignment/i)).not.toBeInTheDocument();
  });

  it('does NOT render "Publish" button', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorAssignmentsPage } = await import('@/pages/instructor/AssignmentsPage');
    render(wrapper(<InstructorAssignmentsPage />));
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
  });

  it('shows "No assignments found" empty state', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    const { default: InstructorAssignmentsPage } = await import('@/pages/instructor/AssignmentsPage');
    render(wrapper(<InstructorAssignmentsPage />));
    expect(screen.getByText('No assignments found')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorDocumentsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorDocumentsPage', () => {
  it('renders "Upload Document" button (chunk 6 write flow)', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorDocumentsPage } = await import('@/pages/instructor/DocumentsPage');
    render(wrapper(<InstructorDocumentsPage />));
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('renders the "Documents" page heading', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorDocumentsPage } = await import('@/pages/instructor/DocumentsPage');
    render(wrapper(<InstructorDocumentsPage />));
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorReportsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorReportsPage', () => {
  it('renders skeleton animation class while loading', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }));

    const { default: InstructorReportsPage } = await import('@/pages/instructor/ReportsPage');
    const { container } = render(wrapper(<InstructorReportsPage />));
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page title "Reports" even while loading', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }));

    const { default: InstructorReportsPage } = await import('@/pages/instructor/ReportsPage');
    render(wrapper(<InstructorReportsPage />));
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorNotificationsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorNotificationsPage', () => {
  it('renders "Notifications" heading', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });

    const { default: InstructorNotificationsPage } = await import('@/pages/instructor/NotificationsPage');
    render(wrapper(<InstructorNotificationsPage />));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders filter tabs (All / Unread)', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });

    const { default: InstructorNotificationsPage } = await import('@/pages/instructor/NotificationsPage');
    render(wrapper(<InstructorNotificationsPage />));
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^unread$/i })).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorSubmissionsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorSubmissionsPage', () => {
  it('renders page heading containing "Submission"', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorSubmissionsPage } = await import('@/pages/instructor/SubmissionsPage');
    render(wrapper(<InstructorSubmissionsPage />));
    // The h1 heading is "Submissions Overview"
    expect(screen.getByRole('heading', { name: /submission/i })).toBeInTheDocument();
  });

  it('does NOT render "Approve" or "Reject" buttons', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: InstructorSubmissionsPage } = await import('@/pages/instructor/SubmissionsPage');
    render(wrapper(<InstructorSubmissionsPage />));
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   InstructorAttendancePage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('InstructorAttendancePage', () => {
  it('renders "Attendance" heading', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });

    const { default: InstructorAttendancePage } = await import('@/pages/instructor/AttendancePage');
    render(wrapper(<InstructorAttendancePage />));
    expect(screen.getByText('Attendance')).toBeInTheDocument();
  });

  it('renders "Active Sessions" tab text', async () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });

    const { default: InstructorAttendancePage } = await import('@/pages/instructor/AttendancePage');
    render(wrapper(<InstructorAttendancePage />));
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });
});
