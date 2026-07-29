/**
 * Chunk 5 — SubMentor read-view smoke tests
 *
 * Strategy:
 *   - mock @tanstack/react-query so no real HTTP calls happen
 *   - mock heavy feature components that pull in Recharts / FullCalendar
 *   - set auth store state to SUB_MENTOR before each test
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

function makeSubMentor(): User {
  return {
    id: 'inst-1',
    email: 'subMentor@test.com',
    full_name: 'Test SubMentor',
    role: 'SUB_MENTOR',
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
  it('returns false for SUB_MENTOR on edit + class', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const { useCan } = await import('@/hooks/useCan');
    const { result } = renderHook(() => useCan('edit', 'class'), { wrapper: hookWrapper() });
    expect(result.current).toBe(false);
  });

  it('returns false for SUB_MENTOR on create + group', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
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
   SubMentorDashboardPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorDashboardPage', () => {
  it('renders skeleton/loading state without crashing when isLoading=true', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }));

    const { default: SubMentorDashboardPage } = await import('@/pages/sub-mentor/DashboardPage');
    const { container } = render(wrapper(<SubMentorDashboardPage />));
    // Should render the skeleton (animate-pulse wrapper) not KPI cards
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-card')).not.toBeInTheDocument();
  });

  it('shows empty-state with no-groups copy when myGroups returns empty array', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery
      .mockReturnValueOnce(qResult({ data: { data: {} }, isLoading: false, isError: false, refetch: vi.fn() }))
      .mockReturnValueOnce(qResult({ data: { data: [] }, isLoading: false, isError: false, refetch: vi.fn() }));

    const { default: SubMentorDashboardPage } = await import('@/pages/sub-mentor/DashboardPage');
    render(wrapper(<SubMentorDashboardPage />));
    expect(screen.getByText('No groups assigned')).toBeInTheDocument();
  });

  it('shows assigned-groups subtitle when 2 groups are assigned', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
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

    const { default: SubMentorDashboardPage } = await import('@/pages/sub-mentor/DashboardPage');
    render(wrapper(<SubMentorDashboardPage />));
    expect(screen.getByText('Showing data for your 2 assigned groups.')).toBeInTheDocument();
  });

  it('renders without crashing even when chart data is empty arrays', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
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

    const { default: SubMentorDashboardPage } = await import('@/pages/sub-mentor/DashboardPage');
    const { container } = render(wrapper(<SubMentorDashboardPage />));
    expect(container).toBeTruthy();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorGroupsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorGroupsPage', () => {
  it('renders empty state "No groups assigned yet" when query returns empty array', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorGroupsPage } = await import('@/pages/sub-mentor/GroupsPage');
    render(wrapper(<SubMentorGroupsPage />));
    expect(screen.getByText(/No groups assigned yet/i)).toBeInTheDocument();
  });

  it('renders group cards with group names when data is returned', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: [{ id: 'g1', name: 'Alpha Group', participant_count: 10 }] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    const { default: SubMentorGroupsPage } = await import('@/pages/sub-mentor/GroupsPage');
    render(wrapper(<SubMentorGroupsPage />));
    expect(screen.getByText('Alpha Group')).toBeInTheDocument();
  });

  it('does NOT render a "New Group" button', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorGroupsPage } = await import('@/pages/sub-mentor/GroupsPage');
    render(wrapper(<SubMentorGroupsPage />));
    expect(screen.queryByText('New Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Group')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorGroupDetailPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorGroupDetailPage', () => {
  const mockGroupDetail = {
    id: 'g1',
    name: 'Beta Group',
    description: 'A test group',
    is_archived: false,
    participants_count: 5,
    participants: [],
    sub_mentors: [],
  };

  it('renders "Assigned Groups" back button text', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: mockGroupDetail },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));

    const { default: SubMentorGroupDetailPage } = await import('@/pages/sub-mentor/GroupDetailPage');
    render(
      <QueryClientProvider client={makeQc()}>
        <MemoryRouter initialEntries={['/sub-mentor/groups/g1']}>
          <Routes>
            <Route path="/sub-mentor/groups/:id" element={<SubMentorGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Assigned Groups')).toBeInTheDocument();
  });

  it('renders GroupHeader with the group name', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: mockGroupDetail },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));

    const { default: SubMentorGroupDetailPage } = await import('@/pages/sub-mentor/GroupDetailPage');
    render(
      <QueryClientProvider client={makeQc()}>
        <MemoryRouter initialEntries={['/sub-mentor/groups/g1']}>
          <Routes>
            <Route path="/sub-mentor/groups/:id" element={<SubMentorGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('group-header')).toBeInTheDocument();
    expect(screen.getByText('Beta Group')).toBeInTheDocument();
  });

  it('does NOT render an "Add Participants" button', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: mockGroupDetail },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));

    const { default: SubMentorGroupDetailPage } = await import('@/pages/sub-mentor/GroupDetailPage');
    render(
      <QueryClientProvider client={makeQc()}>
        <MemoryRouter initialEntries={['/sub-mentor/groups/g1']}>
          <Routes>
            <Route path="/sub-mentor/groups/:id" element={<SubMentorGroupDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.queryByText('Add Participants')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage SubMentors')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorClassesPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorClassesPage', () => {
  it('does NOT render a "Schedule Class" button', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorClassesPage } = await import('@/pages/sub-mentor/ClassesPage');
    render(wrapper(<SubMentorClassesPage />));
    // No button with "Schedule" text should exist
    expect(screen.queryByRole('button', { name: /schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/schedule class/i)).not.toBeInTheDocument();
  });

  it('renders empty state "No classes found" when classes list is empty', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    const { default: SubMentorClassesPage } = await import('@/pages/sub-mentor/ClassesPage');
    render(wrapper(<SubMentorClassesPage />));
    expect(screen.getByText('No classes found.')).toBeInTheDocument();
  });

  it('renders "Classes" page heading', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorClassesPage } = await import('@/pages/sub-mentor/ClassesPage');
    render(wrapper(<SubMentorClassesPage />));
    expect(screen.getByText('Classes')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorAssignmentsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorAssignmentsPage', () => {
  it('does NOT render "Create Assignment" button', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorAssignmentsPage } = await import('@/pages/sub-mentor/AssignmentsPage');
    render(wrapper(<SubMentorAssignmentsPage />));
    expect(screen.queryByText(/create assignment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new assignment/i)).not.toBeInTheDocument();
  });

  it('does NOT render "Publish" button', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorAssignmentsPage } = await import('@/pages/sub-mentor/AssignmentsPage');
    render(wrapper(<SubMentorAssignmentsPage />));
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
  });

  it('shows "No assignments found" empty state', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({
      data: { data: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    const { default: SubMentorAssignmentsPage } = await import('@/pages/sub-mentor/AssignmentsPage');
    render(wrapper(<SubMentorAssignmentsPage />));
    expect(screen.getByText('No assignments found')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorDocumentsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorDocumentsPage', () => {
  it('renders "Upload Document" button (chunk 6 write flow)', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorDocumentsPage } = await import('@/pages/sub-mentor/DocumentsPage');
    render(wrapper(<SubMentorDocumentsPage />));
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('renders the "Documents" page heading', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorDocumentsPage } = await import('@/pages/sub-mentor/DocumentsPage');
    render(wrapper(<SubMentorDocumentsPage />));
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorReportsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorReportsPage', () => {
  it('renders skeleton animation class while loading', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }));

    const { default: SubMentorReportsPage } = await import('@/pages/sub-mentor/ReportsPage');
    const { container } = render(wrapper(<SubMentorReportsPage />));
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page title "Reports" even while loading', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(qResult({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }));

    const { default: SubMentorReportsPage } = await import('@/pages/sub-mentor/ReportsPage');
    render(wrapper(<SubMentorReportsPage />));
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorNotificationsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorNotificationsPage', () => {
  it('renders "Notifications" heading', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });

    const { default: SubMentorNotificationsPage } = await import('@/pages/sub-mentor/NotificationsPage');
    render(wrapper(<SubMentorNotificationsPage />));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders filter tabs (All / Unread)', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });

    const { default: SubMentorNotificationsPage } = await import('@/pages/sub-mentor/NotificationsPage');
    render(wrapper(<SubMentorNotificationsPage />));
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^unread$/i })).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorSubmissionsPage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorSubmissionsPage', () => {
  it('renders page heading containing "Submission"', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorSubmissionsPage } = await import('@/pages/sub-mentor/SubmissionsPage');
    render(wrapper(<SubMentorSubmissionsPage />));
    // The h1 heading is "Submissions Overview"
    expect(screen.getByRole('heading', { name: /submission/i })).toBeInTheDocument();
  });

  it('does NOT render "Approve" or "Reject" buttons', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });
    const useQuery = await getMockedUseQuery();
    useQuery.mockReturnValue(emptyListResult);

    const { default: SubMentorSubmissionsPage } = await import('@/pages/sub-mentor/SubmissionsPage');
    render(wrapper(<SubMentorSubmissionsPage />));
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SubMentorAttendancePage tests
   ═══════════════════════════════════════════════════════════════════════════ */

describe('SubMentorAttendancePage', () => {
  it('renders "Attendance" heading', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });

    const { default: SubMentorAttendancePage } = await import('@/pages/sub-mentor/AttendancePage');
    render(wrapper(<SubMentorAttendancePage />));
    expect(screen.getByText('Attendance')).toBeInTheDocument();
  });

  it('renders "Active Sessions" tab text', async () => {
    useAuthStore.setState({ user: makeSubMentor(), accessToken: 'tok' });

    const { default: SubMentorAttendancePage } = await import('@/pages/sub-mentor/AttendancePage');
    render(wrapper(<SubMentorAttendancePage />));
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });
});
