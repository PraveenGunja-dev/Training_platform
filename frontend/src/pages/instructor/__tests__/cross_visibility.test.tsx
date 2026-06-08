import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useCan } from '@/hooks/useCan';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false })),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() })),
  };
});

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'cls-ro' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}));

vi.mock('@fullcalendar/react', () => ({
  default: () => React.createElement('div', { 'data-testid': 'fullcalendar' }),
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/list', () => ({ default: {} }));
vi.mock('@fullcalendar/interaction', () => ({ default: {} }));

const instructorUser = {
  id: 'ins-1',
  email: 'ins@test.com',
  full_name: 'Test Instructor',
  role: 'INSTRUCTOR' as const,
  photo_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

const qResult = (data: unknown, extra = {}) =>
  ({ data, isLoading: false, isFetching: false, isError: false, ...extra }) as ReturnType<typeof useQuery>;

// ---------------------------------------------------------------------------
// useCan — read_only flag
// ---------------------------------------------------------------------------

describe('useCan — read_only flag', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({ user: instructorUser } as ReturnType<typeof useAuthStore>);
    // myGroupIds returns a Set containing group-1
    vi.mocked(useQuery).mockReturnValue(qResult(new Set(['group-1'])));
  });

  it('returns false for edit when read_only=true even if group_id matches assigned', () => {
    const { result } = renderHook(() =>
      useCan('edit', 'class', { group_id: 'group-1', read_only: true })
    );
    expect(result.current).toBe(false);
  });

  it('returns false for start_session when read_only=true', () => {
    const { result } = renderHook(() =>
      useCan('start_session', 'attendance_session', { group_id: 'group-1', read_only: true })
    );
    expect(result.current).toBe(false);
  });

  it('returns false for end_session when read_only=true', () => {
    const { result } = renderHook(() =>
      useCan('end_session', 'attendance_session', { group_id: 'group-1', read_only: true })
    );
    expect(result.current).toBe(false);
  });

  it('returns false for delete when read_only=true', () => {
    const { result } = renderHook(() =>
      useCan('delete', 'class', { group_id: 'group-1', read_only: true })
    );
    expect(result.current).toBe(false);
  });

  it('returns true when read_only=false and group_id is assigned', () => {
    const { result } = renderHook(() =>
      useCan('edit', 'class', { group_id: 'group-1', read_only: false })
    );
    expect(result.current).toBe(true);
  });

  it('returns true when read_only is undefined and group_id is assigned', () => {
    const { result } = renderHook(() =>
      useCan('edit', 'class', { group_id: 'group-1' })
    );
    expect(result.current).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// InstructorCalendar — cross-visibility
// ---------------------------------------------------------------------------

describe('InstructorCalendar — cross-visibility', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({ user: instructorUser } as ReturnType<typeof useAuthStore>);
  });

  it('shows cross-visibility info banner when effective_can_view_all=true', async () => {
    const { InstructorCalendar } = await import('@/features/instructor/calendar/InstructorCalendar');
    vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
      const key = (opts.queryKey as string[])[0];
      if (key === 'instructor') {
        return qResult({ data: [{ id: 'g1', name: 'Group A', participant_count: 5 }], effective_can_view_all: true });
      }
      return qResult({ data: [] });
    });
    render(React.createElement(InstructorCalendar));
    expect(screen.getByRole('note', { name: /cross-visibility notice/i })).toBeTruthy();
  });

  it('does NOT show banner when effective_can_view_all=false', async () => {
    const { InstructorCalendar } = await import('@/features/instructor/calendar/InstructorCalendar');
    vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
      const key = (opts.queryKey as string[])[0];
      if (key === 'instructor') {
        return qResult({ data: [{ id: 'g1', name: 'Group A', participant_count: 5 }], effective_can_view_all: false });
      }
      return qResult({ data: [] });
    });
    render(React.createElement(InstructorCalendar));
    expect(screen.queryByRole('note', { name: /cross-visibility notice/i })).toBeNull();
  });

  it('shows updated header title when effective_can_view_all=true', async () => {
    const { InstructorCalendar } = await import('@/features/instructor/calendar/InstructorCalendar');
    vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
      const key = (opts.queryKey as string[])[0];
      if (key === 'instructor') {
        return qResult({ data: [], effective_can_view_all: true });
      }
      return qResult({ data: [] });
    });
    render(React.createElement(InstructorCalendar));
    expect(screen.getByText(/all instructors' classes/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ClassDetailPage — read_only mode
// ---------------------------------------------------------------------------

describe('ClassDetailPage — read_only mode', () => {
  const readOnlyCls = {
    id: 'cls-ro',
    group_id: 'g-other',
    group_name: 'Other Group',
    title: 'Read Only Class',
    description: '',
    starts_at: '2026-06-10T10:00:00Z',
    ends_at: '2026-06-10T11:00:00Z',
    attendance_open_at: '2026-06-10T09:45:00Z',
    attendance_close_at: '2026-06-10T11:15:00Z',
    allow_late_attendance: false,
    status: 'UPCOMING' as const,
    active_session: null,
    last_session: null,
    my_record: null,
    participants_count: 10,
    related_tasks: [],
    read_only: true,
  };

  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({ user: instructorUser } as ReturnType<typeof useAuthStore>);
    vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
      const key = (opts.queryKey as string[])[0];
      // classesApi.get() returns ApiEnvelope<ClassSession> = { data: ClassSession }
      if (key === 'class') return qResult({ data: readOnlyCls });
      // useCan query: myGroupIds set does NOT include g-other
      return qResult(new Set(['group-1']));
    });
  });

  it('does NOT render Edit Class button when read_only=true', async () => {
    const { default: InstructorClassDetailPage } = await import('@/pages/instructor/ClassDetailPage');
    render(React.createElement(InstructorClassDetailPage));
    expect(screen.queryByText(/edit class/i)).toBeNull();
  });

  it('does NOT render Cancel Class button when read_only=true', async () => {
    const { default: InstructorClassDetailPage } = await import('@/pages/instructor/ClassDetailPage');
    render(React.createElement(InstructorClassDetailPage));
    expect(screen.queryByText(/cancel class/i)).toBeNull();
  });

  it('shows View only banner when read_only=true', async () => {
    const { default: InstructorClassDetailPage } = await import('@/pages/instructor/ClassDetailPage');
    render(React.createElement(InstructorClassDetailPage));
    expect(screen.getByText(/view only/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// DashboardPage — cross-visibility chip
// ---------------------------------------------------------------------------

const baseDashboard = {
  kpis: {
    total_participants: 10, total_groups: 4,
    classes_today: 1, classes_upcoming: 2,
    submitted: 5, pending: 3, late: 1, pending_approvals: 0,
  },
  charts: {
    attendance_pie: [], submission_bar: [], group_comparison: [],
    daily_upload_trend: [], deadline_tracking: [], weekly_trend: [], class_status: [],
  },
  recent_activity: [],
  participant_activity: [],
};

describe('DashboardPage — cross-visibility chip', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({ user: instructorUser } as ReturnType<typeof useAuthStore>);
  });

  it('shows chip when effective_can_view_all=true', async () => {
    vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
      const key = (opts.queryKey as string[])[0];
      // dashboardApi.admin() returns ApiEnvelope<DashboardData> = { data: DashboardData }
      if (key === 'dashboard') return qResult({ data: baseDashboard });
      if (key === 'instructor') {
        return qResult({ data: [{ id: 'g1', name: 'Group A', participant_count: 5 }], effective_can_view_all: true });
      }
      return qResult(undefined);
    });
    const { default: InstructorDashboardPage } = await import('@/pages/instructor/DashboardPage');
    render(React.createElement(InstructorDashboardPage));
    expect(screen.getByText(/showing all groups/i)).toBeTruthy();
  });

  it('does NOT show chip when effective_can_view_all=false', async () => {
    vi.mocked(useQuery).mockImplementation((opts: Parameters<typeof useQuery>[0]) => {
      const key = (opts.queryKey as string[])[0];
      if (key === 'dashboard') return qResult({ data: baseDashboard });
      if (key === 'instructor') {
        return qResult({ data: [{ id: 'g1', name: 'Group A', participant_count: 5 }], effective_can_view_all: false });
      }
      return qResult(undefined);
    });
    const { default: InstructorDashboardPage } = await import('@/pages/instructor/DashboardPage');
    render(React.createElement(InstructorDashboardPage));
    expect(screen.queryByText(/showing all groups/i)).toBeNull();
  });
});
