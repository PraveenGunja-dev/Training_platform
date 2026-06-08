/**
 * Chunk 6 — Instructor write-flow tests
 *
 * Strategy:
 *   - Mock @tanstack/react-query globally (useQuery via queryKey-keyed impl,
 *     useMutation via stable mockReturnValue)
 *   - Mock heavy feature dialogs so no large dep graph is pulled in
 *   - Mock useCan globally (default true); override per-test for denial cases
 *   - Set auth store state before each test
 *   - afterEach clears mocks so `mockReturnValueOnce` queues don't leak
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

/* ── Heavy dialog / feature stubs ───────────────────────────────────── */

vi.mock('@/features/admin/scheduling/ScheduleClassDialog', () => ({
  ScheduleClassDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="schedule-class-dialog" /> : null,
}));
vi.mock('@/features/admin/class/EditClassDialog', () => ({
  EditClassDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-class-dialog" /> : null,
}));
vi.mock('@/features/admin/class/CancelClassDialog', () => ({
  CancelClassDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="cancel-class-dialog" /> : null,
}));
vi.mock('@/features/admin/attendance/StartAttendanceDialog', () => ({
  StartAttendanceDialog: () => (
    <button data-testid="start-attendance-btn">Start Attendance</button>
  ),
}));
vi.mock('@/features/admin/attendance/EndAttendanceDialog', () => ({
  EndAttendanceDialog: () => (
    <button data-testid="end-attendance-btn">End Session</button>
  ),
}));
vi.mock('@/features/admin/assignments/CreateAssignmentDialog', () => ({
  CreateAssignmentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-assignment-dialog" /> : null,
}));
vi.mock('@/features/admin/submissions/SubmissionsTable', () => ({
  SubmissionsTable: () => <div data-testid="submissions-table" />,
}));
vi.mock('@/features/admin/documents/UploadDocumentDialog', () => ({
  UploadDocumentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="upload-document-dialog" /> : null,
}));
vi.mock('@/features/admin/shared-uploads/ApprovalQueueTable', () => ({
  ApprovalQueueTable: ({ uploads }: { uploads: unknown[] }) => (
    <div data-testid="approval-queue-table">{uploads.length} uploads</div>
  ),
}));
vi.mock('@/features/admin/attendance/ClassAttendancePanel', () => ({
  ClassAttendancePanel: () => <div data-testid="attendance-panel" />,
}));
vi.mock('@/features/admin/class/ClassSubmissionsPanel', () => ({
  ClassSubmissionsPanel: () => <div data-testid="class-submissions-panel" />,
}));
vi.mock('@/features/participant/class/RelatedTasksCard', () => ({
  RelatedTasksCard: () => <div data-testid="related-tasks" />,
}));
vi.mock('@/features/instructor/calendar/InstructorCalendar', () => ({
  InstructorCalendar: () => <div data-testid="instructor-calendar" />,
}));

/* ── react-query global mock ─────────────────────────────────────────── */

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery:      vi.fn(),
    useMutation:   vi.fn(),
    useQueryClient: vi.fn(),
  };
});

/* ── useCan global mock (default true; override per-test for denials) ── */

vi.mock('@/hooks/useCan', () => ({
  useCan: vi.fn().mockReturnValue(true),
}));

/* ── Toast mock ─────────────────────────────────────────────────────── */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/* ── Import mocked symbols ───────────────────────────────────────────── */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCan } from '@/hooks/useCan';

/* ── Fixtures ────────────────────────────────────────────────────────── */

function makeInstructor(): User {
  return {
    id: 'inst-1', email: 'instructor@test.com', full_name: 'Test Instructor',
    role: 'INSTRUCTOR', photo_url: null, is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}
function makeAdmin(): User {
  return {
    id: 'admin-1', email: 'admin@test.com', full_name: 'Test Admin',
    role: 'ADMIN', photo_url: null, is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}
function makeParticipant(): User {
  return {
    id: 'p-1', email: 'p@test.com', full_name: 'Participant',
    role: 'PARTICIPANT', photo_url: null, is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

// Wrap a data payload in the UseQueryResult shape
function qResult<T>(data: T) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never;
}

// A mutation object that satisfies the components' usage
function mockMut() {
  return {
    mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false, isLoading: false, isError: false,
  } as never;
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// useQuery implementation keyed on first element of queryKey
function makeQueryImpl(map: Record<string, unknown>) {
  return (opts: unknown) => {
    const key = (opts as { queryKey: unknown[] }).queryKey[0] as string;
    if (key in map) return qResult({ data: map[key] });
    return qResult({ data: [] });
  };
}

function wrap(ui: React.ReactElement, path = '/') {
  const qc = makeQc();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

function wrapRouted(element: React.ReactElement, path: string, paramPath: string) {
  const qc = makeQc();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={paramPath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/* ── Shared beforeEach / afterEach ───────────────────────────────────── */

afterEach(() => {
  vi.clearAllMocks();
});

/* ================================================================
   1. useCan hook — authorization logic via mocked hook
   ================================================================ */

describe('useCan — authorization matrix', () => {
  it('admin always returns true', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    const { result } = renderHook(() => useCan('edit', 'class', { group_id: 'any' }));
    expect(result.current).toBe(true);
  });

  it('participant always returns false for write actions', () => {
    useAuthStore.setState({ user: makeParticipant(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(false);
    const { result } = renderHook(() => useCan('edit', 'class', { group_id: 'g-1' }));
    expect(result.current).toBe(false);
  });

  it('instructor returns false for unassigned group', () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(false);
    const { result } = renderHook(() =>
      useCan('edit', 'class', { group_id: 'not-my-group' })
    );
    expect(result.current).toBe(false);
  });

  it('instructor returns true for assigned group (edit)', () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    const { result } = renderHook(() =>
      useCan('edit', 'class', { group_id: 'g-1' })
    );
    expect(result.current).toBe(true);
  });

  it('instructor returns false for document delete when uploaded by someone else', () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(false);
    const { result } = renderHook(() =>
      useCan('delete', 'document', { group_id: 'g-1', uploaded_by_id: 'other-user' })
    );
    expect(result.current).toBe(false);
  });

  it('instructor returns true for document delete of own upload in assigned group', () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    const { result } = renderHook(() =>
      useCan('delete', 'document', { group_id: 'g-1', uploaded_by_id: 'inst-1' })
    );
    expect(result.current).toBe(true);
  });
});

/* ================================================================
   2. ClassesPage — Schedule Class write flow
   ================================================================ */

describe('ClassesPage — scheduling', () => {
  const groups = [{ id: 'g-1', name: 'Group A' }];
  const classes: never[] = [];

  beforeEach(() => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    vi.mocked(useMutation).mockReturnValue(mockMut());
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
    vi.mocked(useQuery).mockImplementation(
      makeQueryImpl({ groups, classes }) as never
    );
  });

  async function renderPage() {
    const { default: ClassesPage } = await import('../ClassesPage');
    render(wrap(<ClassesPage />));
  }

  it('Schedule Class button visible when canCreate is true', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /schedule class/i })).toBeInTheDocument();
  });

  it('Schedule Class button hidden when canCreate is false', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    await renderPage();
    expect(screen.queryByRole('button', { name: /schedule class/i })).toBeNull();
  });

  it('clicking Schedule Class opens ScheduleClassDialog', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /schedule class/i }));
    expect(screen.getByTestId('schedule-class-dialog')).toBeInTheDocument();
  });
});

/* ================================================================
   3. ClassDetailPage — edit / cancel / attendance
   ================================================================ */

describe('ClassDetailPage — write flows', () => {
  type ActiveSession = {
    id: string; class_id: string; class_title: string; group_id: string;
    started_at: string; ended_at: string | null;
    started_by: { id: string; full_name: string };
    ended_by: null | { id: string; full_name: string };
    status: string; duration_minutes: number | null; scheduled_end_at: string | null;
  };
  type ClsData = {
    id: string; title: string; group_id: string; group_name: string;
    status: string; starts_at: string; ends_at: string;
    description: string; allow_late_attendance: boolean; participants_count: number;
    active_session: ActiveSession | null; related_tasks: never[];
  };
  const clsUpcoming: ClsData = {
    id: 'cls-1', title: 'Safety Training', group_id: 'g-1', group_name: 'Group A',
    status: 'UPCOMING', starts_at: '2026-06-01T10:00:00Z', ends_at: '2026-06-01T12:00:00Z',
    description: '', allow_late_attendance: false, participants_count: 5,
    active_session: null, related_tasks: [],
  };
  const clsOngoing: ClsData = {
    ...clsUpcoming, status: 'ONGOING',
    active_session: {
      id: 'sess-1', class_id: 'cls-1', class_title: 'Safety Training',
      group_id: 'g-1', started_at: '2026-06-01T09:45:00Z', ended_at: null,
      started_by: { id: 'inst-1', full_name: 'Test Instructor' },
      ended_by: null, status: 'ACTIVE', duration_minutes: 20, scheduled_end_at: null,
    },
  };
  const clsCancelled: ClsData = { ...clsUpcoming, status: 'CANCELLED' };

  beforeEach(() => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    vi.mocked(useMutation).mockReturnValue(mockMut());
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
  });

  function setClass(cls: typeof clsUpcoming) {
    vi.mocked(useQuery).mockImplementation(
      makeQueryImpl({ class: cls }) as never
    );
  }

  async function renderDetail() {
    const { default: ClassDetailPage } = await import('../ClassDetailPage');
    render(wrapRouted(<ClassDetailPage />, '/instructor/classes/cls-1', '/instructor/classes/:id'));
  }

  it('Edit Class button visible for UPCOMING class', async () => {
    setClass(clsUpcoming);
    await renderDetail();
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });

  it('Cancel Class button visible for UPCOMING class', async () => {
    setClass(clsUpcoming);
    await renderDetail();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('Cancel Class button hidden when class is already CANCELLED', async () => {
    setClass(clsCancelled);
    await renderDetail();
    expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull();
  });

  it('Start Attendance button visible for UPCOMING class without active session', async () => {
    setClass(clsUpcoming);
    await renderDetail();
    expect(screen.getByTestId('start-attendance-btn')).toBeInTheDocument();
  });

  it('Start Attendance visible regardless of time — no frontend time gate', async () => {
    // Class starts at 10:00 but Start button should appear at any current time
    const earlyClass = { ...clsUpcoming, starts_at: '2026-06-01T10:00:00Z' };
    setClass(earlyClass);
    await renderDetail();
    expect(screen.getByTestId('start-attendance-btn')).toBeInTheDocument();
  });

  it('End Session button visible when session is ACTIVE', async () => {
    setClass(clsOngoing);
    await renderDetail();
    expect(screen.getByTestId('end-attendance-btn')).toBeInTheDocument();
  });

  it('Start Attendance hidden when session is ACTIVE', async () => {
    setClass(clsOngoing);
    await renderDetail();
    expect(screen.queryByTestId('start-attendance-btn')).toBeNull();
  });

  it('Scheduled time label visible in meta row', async () => {
    setClass(clsUpcoming);
    await renderDetail();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
  });

  it('"Actual" time and "(ongoing)" visible when session has started', async () => {
    setClass(clsOngoing);
    await renderDetail();
    expect(screen.getByText(/actual/i)).toBeInTheDocument();
    // "(ongoing)" text appears in the time cell; "Ongoing" badge is separate
    expect(screen.getByText(/\(ongoing\)/i)).toBeInTheDocument();
  });

  it('clicking Edit Class opens EditClassDialog', async () => {
    setClass(clsUpcoming);
    await renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByTestId('edit-class-dialog')).toBeInTheDocument();
  });

  it('clicking Cancel Class opens CancelClassDialog', async () => {
    setClass(clsUpcoming);
    await renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByTestId('cancel-class-dialog')).toBeInTheDocument();
  });

  it('Edit + Start buttons hidden when useCan returns false', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    setClass(clsUpcoming);
    await renderDetail();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByTestId('start-attendance-btn')).toBeNull();
  });
});

/* ================================================================
   4. AssignmentsPage — create / publish / close / delete
   ================================================================ */

describe('AssignmentsPage — write flows', () => {
  const lockedTask = {
    id: 't-1', title: 'Assignment Alpha', group_id: 'g-1', group_name: 'Group A',
    class_title: null, deadline_at: '2026-07-01T12:00:00Z', late_policy: 'STRICT',
    is_open: false, is_closed: false, upload_open_at: '2099-01-01T00:00:00Z',
  };
  const openTask = {
    ...lockedTask, id: 't-2', title: 'Assignment Beta',
    is_open: true, upload_open_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    vi.mocked(useMutation).mockReturnValue(mockMut());
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
    vi.mocked(useQuery).mockImplementation(
      makeQueryImpl({
        groups:      [{ id: 'g-1', name: 'Group A' }],
        assignments: [lockedTask, openTask],
      }) as never
    );
  });

  async function renderPage() {
    const { default: AssignmentsPage } = await import('../AssignmentsPage');
    render(wrap(<AssignmentsPage />));
  }

  it('Create Assignment button visible when canCreate true', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /create assignment/i })).toBeInTheDocument();
  });

  it('clicking Create Assignment opens CreateAssignmentDialog', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /create assignment/i }));
    expect(screen.getByTestId('create-assignment-dialog')).toBeInTheDocument();
  });

  it('Publish button visible for LOCKED assignment', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });

  it('Close button visible for OPEN assignment', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
  });

  it('Delete button visible for LOCKED assignment', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('Create Assignment button hidden when canCreate returns false', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    await renderPage();
    expect(screen.queryByRole('button', { name: /create assignment/i })).toBeNull();
  });
});

/* ================================================================
   5. AssignmentDetailPage — publish / close / delete / SubmissionsTable
   ================================================================ */

describe('AssignmentDetailPage — write flows', () => {
  const lockedTask = {
    id: 't-1', title: 'Safety Report', group_id: 'g-1', group_name: 'Group A',
    class_title: null, late_policy: 'STRICT',
    is_open: false, is_closed: false, upload_open_at: '2099-01-01T00:00:00Z',
    deadline_at: '2026-07-01T12:00:00Z', reminder_offsets: [60, 30],
    question: 'Describe the protocol.', description: '', instructions: '',
  };
  const openTask = {
    ...lockedTask, is_open: true, upload_open_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    vi.mocked(useMutation).mockReturnValue(mockMut());
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
  });

  async function renderDetail(task: typeof lockedTask) {
    vi.mocked(useQuery).mockImplementation(
      makeQueryImpl({ assignment: task }) as never
    );
    const { default: AssignmentDetailPage } = await import('../AssignmentDetailPage');
    render(wrapRouted(
      <AssignmentDetailPage />,
      '/instructor/assignments/t-1',
      '/instructor/assignments/:id',
    ));
  }

  it('renders SubmissionsTable component', async () => {
    await renderDetail(lockedTask);
    expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
  });

  it('Publish button visible for LOCKED assignment', async () => {
    await renderDetail(lockedTask);
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });

  it('Delete button visible for LOCKED assignment', async () => {
    await renderDetail(lockedTask);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('Close button visible for OPEN assignment', async () => {
    await renderDetail(openTask);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('no write buttons when useCan returns false', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    await renderDetail(lockedTask);
    expect(screen.queryByRole('button', { name: /publish/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});

/* ================================================================
   6. DocumentsPage — upload / delete own / hide delete for others
   ================================================================ */

describe('DocumentsPage — write flows', () => {
  const ownDoc = {
    id: 'd-1', group_id: 'g-1', title: 'Safety Slides', doc_type: 'SLIDES',
    visibility: 'GROUP', file_type: 'application/pdf', file_size: 512000,
    uploaded_by_id: 'inst-1', created_at: '2026-01-01T00:00:00Z',
    file_url: 'blob://d-1', file_name: 'slides.pdf',
  };
  const adminDoc = {
    ...ownDoc, id: 'd-2', title: 'Admin Guide', uploaded_by_id: 'admin-1',
  };

  beforeEach(() => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useMutation).mockReturnValue(mockMut());
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
    vi.mocked(useQuery).mockImplementation(
      makeQueryImpl({
        groups:    [{ id: 'g-1', name: 'Group A' }],
        documents: [ownDoc, adminDoc],
      }) as never
    );
  });

  async function renderPage() {
    const { default: DocumentsPage } = await import('../DocumentsPage');
    render(wrap(<DocumentsPage />));
  }

  it('Upload Document button is visible', async () => {
    vi.mocked(useCan).mockReturnValue(true);
    await renderPage();
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('clicking Upload Document opens UploadDocumentDialog', async () => {
    vi.mocked(useCan).mockReturnValue(true);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /upload document/i }));
    expect(screen.getByTestId('upload-document-dialog')).toBeInTheDocument();
  });

  it('Delete button shown for own document, hidden for admin document', async () => {
    vi.mocked(useCan).mockImplementation(
      (_action: string, _res: string, data?: { group_id?: string; uploaded_by_id?: string }) => {
        if (_action === 'delete' && _res === 'document') {
          return data?.uploaded_by_id === 'inst-1';
        }
        return true;
      }
    );
    await renderPage();
    const deleteBtns = screen.queryAllByTitle(/delete/i);
    // Only 1 delete button (for own doc), not 2
    expect(deleteBtns).toHaveLength(1);
  });

  it('no Delete buttons when useCan always returns false', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    await renderPage();
    expect(screen.queryAllByTitle(/delete/i)).toHaveLength(0);
  });
});

/* ================================================================
   7. SharedUploadsPage — approval queue rendered
   ================================================================ */

describe('SharedUploadsPage — approval queue', () => {
  const upload = {
    id: 'u-1', group_id: 'g-1', uploaded_by_id: 'p-1', title: 'My Cert',
    file_name: 'cert.pdf', file_type: 'application/pdf', file_size: 100000,
    file_url: 'blob://u-1', suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null,
    rejection_reason: null, resulting_document_id: null, created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useCan).mockReturnValue(true);
    vi.mocked(useMutation).mockReturnValue(mockMut());
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
  });

  async function renderPage(uploads: unknown[] = []) {
    vi.mocked(useQuery).mockImplementation(
      makeQueryImpl({
        'shared-uploads-pending': uploads,
        groups: [],
      }) as never
    );
    const { default: SharedUploadsPage } = await import('../SharedUploadsPage');
    render(wrap(<SharedUploadsPage />));
  }

  it('renders ApprovalQueueTable when pending uploads exist', async () => {
    await renderPage([upload]);
    expect(screen.getByTestId('approval-queue-table')).toBeInTheDocument();
    expect(screen.getByText(/1 uploads/i)).toBeInTheDocument();
  });

  it('shows "All caught up" empty state when queue is empty', async () => {
    await renderPage([]);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('page title "Shared Uploads" is present', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { name: /shared uploads/i })).toBeInTheDocument();
  });
});
