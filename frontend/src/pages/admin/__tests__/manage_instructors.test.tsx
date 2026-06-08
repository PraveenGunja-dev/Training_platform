/**
 * Chunk 7 — Admin Manage Instructors UI tests
 *
 * Strategy:
 *   - Mock @tanstack/react-query (useQuery / useMutation / useQueryClient)
 *   - Mock heavy sub-components (dialogs, tables) where needed
 *   - Set auth store state before each test
 *   - Test InstructorsTab, UserDetailPage visibility card, SettingsForm toggle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

/* ── react-query global mock ──────────────────────────────────────────────── */

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery:       vi.fn(),
    useMutation:    vi.fn(),
    useQueryClient: vi.fn(),
  };
});

/* ── Toast mock ───────────────────────────────────────────────────────────── */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/* ── Import mocked symbols ────────────────────────────────────────────────── */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

function makeAdmin(): User {
  return {
    id: 'admin-1', email: 'admin@test.com', full_name: 'Test Admin',
    role: 'ADMIN', photo_url: null, is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}
function makeInstructor(overrides: Partial<User> = {}): User {
  return {
    id: 'inst-1', email: 'inst@test.com', full_name: 'Test Instructor',
    role: 'INSTRUCTOR', photo_url: null, is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    can_view_all_classes: null,
    ...overrides,
  };
}
function makeParticipant(): User {
  return {
    id: 'p-1', email: 'p@test.com', full_name: 'Participant',
    role: 'PARTICIPANT', photo_url: null, is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function qResult<T>(data: T) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never;
}

function mockMut(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false, isLoading: false, isError: false,
    ...overrides,
  } as never;
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement, path = '/') {
  const qc = makeQc();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleInstructors = [
  { id: 'inst-1', full_name: 'Alice Smith', email: 'alice@test.com', assigned_at: '2026-04-01T00:00:00Z' },
  { id: 'inst-2', full_name: 'Bob Jones',  email: 'bob@test.com',   assigned_at: '2026-04-10T00:00:00Z' },
];

/* ══════════════════════════════════════════════════════════════════════════ */
/* InstructorsTab                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

import { InstructorsTab } from '@/features/admin/group-instructors/InstructorsTab';

describe('InstructorsTab', () => {
  beforeEach(() => {
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
    vi.mocked(useMutation).mockReturnValue(mockMut());
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('renders Instructors section with instructor list for admin', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('shows Add Instructors button for admin role', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    expect(screen.getByRole('button', { name: /add instructors/i })).toBeInTheDocument();
  });

  it('hides Add Instructors button for non-admin (instructor role)', () => {
    useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    expect(screen.queryByRole('button', { name: /add instructors/i })).not.toBeInTheDocument();
  });

  it('shows empty state copy when no instructors assigned', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: [] }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    expect(
      screen.getByText('No instructors assigned. Admins are running this group.'),
    ).toBeInTheDocument();
  });

  it('links instructor name to user detail page', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    const link = screen.getByRole('link', { name: 'Alice Smith' });
    expect(link).toHaveAttribute('href', '/admin/users/inst-1');
  });

  it('shows remove button for each instructor (admin only)', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    expect(screen.getByRole('button', { name: /remove alice smith/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove bob jones/i })).toBeInTheDocument();
  });

  it('opens confirm dialog when remove button is clicked', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    fireEvent.click(screen.getByRole('button', { name: /remove alice smith/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/remove instructor/i)).toBeInTheDocument();
  });

  it('calls DELETE mutation when confirm remove is clicked', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));
    const mutateFn = vi.fn();
    vi.mocked(useMutation).mockReturnValue(mockMut({ mutate: mutateFn }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    fireEvent.click(screen.getByRole('button', { name: /remove alice smith/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    expect(mutateFn).toHaveBeenCalledWith('inst-1');
  });

  it('opens Add Instructors dialog on button click', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: [] }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    fireEvent.click(screen.getByRole('button', { name: /add instructors/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/search by name or email to find and assign/i)).toBeInTheDocument();
  });

  it('shows instructor count in summary text', () => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQuery).mockReturnValue(qResult({ data: sampleInstructors }));

    render(wrap(<InstructorsTab groupId="g-1" />));

    expect(screen.getByText('2 instructors assigned')).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/* UserDetailPage — Instructor visibility card                               */
/* ══════════════════════════════════════════════════════════════════════════ */

import AdminUserDetailPage from '@/pages/admin/UserDetailPage';

vi.mock('@/features/admin/audit/AuditTable', () => ({
  AuditTable: () => <div data-testid="audit-table" />,
}));

describe('UserDetailPage — Instructor visibility card', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: makeAdmin(), accessToken: 'tok' });
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: vi.fn() } as never);
    vi.mocked(useMutation).mockReturnValue(mockMut());
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('shows Calendar Visibility card when target user is INSTRUCTOR', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor() });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    expect(screen.getByText('Calendar Visibility')).toBeInTheDocument();
    expect(screen.getByText(/inherit system default/i)).toBeInTheDocument();
  });

  it('hides Calendar Visibility card when target user is PARTICIPANT', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeParticipant() });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/p-1'));

    expect(screen.queryByText('Calendar Visibility')).not.toBeInTheDocument();
  });

  it('hides Calendar Visibility card when target user is ADMIN', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeAdmin() });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/admin-1'));

    expect(screen.queryByText('Calendar Visibility')).not.toBeInTheDocument();
  });

  it('radio defaults to "Inherit system default" when can_view_all_classes is null', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor({ can_view_all_classes: null }) });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    const inheritRadio = screen.getByRole('radio', { name: /inherit system default/i });
    expect(inheritRadio).toBeChecked();
  });

  it('radio reflects "view all" when can_view_all_classes is true', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor({ can_view_all_classes: true }) });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    const viewAllRadio = screen.getByRole('radio', { name: /can view all/i });
    expect(viewAllRadio).toBeChecked();
  });

  it('radio reflects "own only" when can_view_all_classes is false', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor({ can_view_all_classes: false }) });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    const ownRadio = screen.getByRole('radio', { name: /only own assigned/i });
    expect(ownRadio).toBeChecked();
  });

  it('clicking "view all" radio calls PATCH mutation with can_view_all_classes=true', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor({ can_view_all_classes: null }) });
      return qResult({ data: [] });
    });
    const mutateFn = vi.fn();
    vi.mocked(useMutation).mockReturnValue(mockMut({ mutate: mutateFn }));

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    fireEvent.click(screen.getByRole('radio', { name: /can view all/i }));

    expect(mutateFn).toHaveBeenCalledWith('all');
  });

  it('clicking "own only" radio calls PATCH mutation with can_view_all_classes=false', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor({ can_view_all_classes: null }) });
      return qResult({ data: [] });
    });
    const mutateFn = vi.fn();
    vi.mocked(useMutation).mockReturnValue(mockMut({ mutate: mutateFn }));

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    fireEvent.click(screen.getByRole('radio', { name: /only own assigned/i }));

    expect(mutateFn).toHaveBeenCalledWith('own');
  });

  it('shows Manage assigned groups link for INSTRUCTOR user', () => {
    vi.mocked(useQuery).mockImplementation((opts: unknown) => {
      const key = (opts as { queryKey: unknown[] }).queryKey[0];
      if (key === 'user') return qResult({ data: makeInstructor() });
      return qResult({ data: [] });
    });

    render(wrap(<AdminUserDetailPage />, '/admin/users/inst-1'));

    const link = screen.getByRole('link', { name: /manage assigned groups/i });
    expect(link).toHaveAttribute('href', '/admin/groups');
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */
/* SettingsForm — Instructor calendar visibility toggle                      */
/* ══════════════════════════════════════════════════════════════════════════ */

import { SettingsForm } from '@/features/admin/settings/SettingsForm';
import type { SettingsFormValues } from '@/features/admin/settings/settingsSchema';

const baseSettings: SettingsFormValues = {
  product_name: 'Test System',
  timezone: 'UTC',
  brand_color: '#4F46E5',
  doc_max_mb: 25,
  image_max_mb: 10,
  video_max_mb: 500,
  reminder_offsets: [],
  session_lifetime_hours: 24,
  instructors_can_view_all_classes: false,
};

describe('SettingsForm — Instructor visibility toggle', () => {
  afterEach(() => { vi.clearAllMocks(); });

  it('renders Instructor Calendar Visibility section', () => {
    render(
      wrap(
        <SettingsForm
          initialValues={baseSettings}
          onSubmit={vi.fn()}
          onForceLogout={vi.fn()}
          saving={false}
          loggingOut={false}
        />,
      ),
    );

    expect(screen.getByText('Instructor Calendar Visibility')).toBeInTheDocument();
    expect(
      screen.getByText(/allow instructors to view classes from all groups/i),
    ).toBeInTheDocument();
  });

  it('toggle is off (aria-checked=false) when instructors_can_view_all_classes=false', () => {
    render(
      wrap(
        <SettingsForm
          initialValues={{ ...baseSettings, instructors_can_view_all_classes: false }}
          onSubmit={vi.fn()}
          onForceLogout={vi.fn()}
          saving={false}
          loggingOut={false}
        />,
      ),
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('toggle is on (aria-checked=true) when instructors_can_view_all_classes=true', () => {
    render(
      wrap(
        <SettingsForm
          initialValues={{ ...baseSettings, instructors_can_view_all_classes: true }}
          onSubmit={vi.fn()}
          onForceLogout={vi.fn()}
          saving={false}
          loggingOut={false}
        />,
      ),
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking toggle flips aria-checked and marks form dirty', () => {
    render(
      wrap(
        <SettingsForm
          initialValues={{ ...baseSettings, instructors_can_view_all_classes: false }}
          onSubmit={vi.fn()}
          onForceLogout={vi.fn()}
          saving={false}
          loggingOut={false}
        />,
      ),
    );

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it('form submit payload includes instructors_can_view_all_classes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      wrap(
        <SettingsForm
          initialValues={{ ...baseSettings, instructors_can_view_all_classes: false }}
          onSubmit={onSubmit}
          onForceLogout={vi.fn()}
          saving={false}
          loggingOut={false}
        />,
      ),
    );

    // Toggle on then submit
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    // Wait for async submit handler
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());

    const payload = onSubmit.mock.calls[0][0] as SettingsFormValues;
    expect(payload.instructors_can_view_all_classes).toBe(true);
  });
});
