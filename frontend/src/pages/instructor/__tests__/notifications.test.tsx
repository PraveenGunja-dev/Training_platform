/**
 * Chunk 09 — Instructor notification UI tests
 *
 * Covers:
 *   1. Bell shows unread count badge
 *   2. NotificationDropdown "Mark all read" triggers mutation
 *   3. Preferences PATCH fires when email toggle clicked
 *   4. In-app toggle is disabled (always-on)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

/* ── helpers ─────────────────────────────────────────────────────────── */

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

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(ui: React.ReactElement) {
  const qc = makeQc();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qResult(val: object): any { return val; }

/* ── module mocks ────────────────────────────────────────────────────── */

// Mock Popover — render trigger only (no dropdown) to keep Bell tests isolated
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // Suppress PopoverContent so the dropdown never mounts in Bell tests
  PopoverContent: () => null,
}));

const mockUpdatePreferences = vi.fn().mockReturnValue(Promise.resolve());

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useInfiniteQuery: vi.fn().mockReturnValue(qResult({
      data: undefined,
      isLoading: true,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    })),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

/* ── reset ────────────────────────────────────────────────────────────── */

beforeEach(async () => {
  useAuthStore.setState({ user: makeInstructor(), accessToken: 'tok' });
  vi.clearAllMocks();

  const { useQuery, useMutation } = await import('@tanstack/react-query');

  vi.mocked(useQuery).mockReturnValue(qResult({
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  }));

  vi.mocked(useMutation).mockReturnValue(qResult({
    mutate: vi.fn(),
    isPending: false,
  }));
});

/* ══════════════════════════════════════════════════════════════════════
   1. Bell shows unread count badge
   ══════════════════════════════════════════════════════════════════════ */

describe('NotificationBell', () => {
  it('renders badge with unread count when count > 0', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue(qResult({
      data: { data: { unread_count: 5 } },
      isLoading: false,
      isError: false,
    }));

    const { NotificationBell } = await import('@/components/layout/NotificationBell');
    wrapper(<NotificationBell />);

    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('hides badge when unread count is 0', async () => {
    const { useQuery } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue(qResult({
      data: { data: { unread_count: 0 } },
      isLoading: false,
      isError: false,
    }));

    const { NotificationBell } = await import('@/components/layout/NotificationBell');
    wrapper(<NotificationBell />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   2. NotificationDropdown — mark all read
   ══════════════════════════════════════════════════════════════════════ */

describe('NotificationDropdown', () => {
  it('calls markAllRead mutation when "Mark all read" is clicked', async () => {
    const { useQuery, useMutation } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue(qResult({
      data: { data: [] },
      isLoading: false,
      isError: false,
    }));

    const markAllMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue(qResult({
      mutate: markAllMutate,
      isPending: false,
    }));

    const { NotificationDropdown } = await import('@/features/notifications/NotificationDropdown');
    wrapper(<NotificationDropdown onClose={vi.fn()} />);

    const btn = screen.getByRole('button', { name: /mark all read/i });
    fireEvent.click(btn);
    expect(markAllMutate).toHaveBeenCalled();
  });

  it('navigates to /instructor/notifications for INSTRUCTOR role', async () => {
    const { useQuery, useMutation } = await import('@tanstack/react-query');
    vi.mocked(useQuery).mockReturnValue(qResult({
      data: { data: [] },
      isLoading: false,
      isError: false,
    }));
    vi.mocked(useMutation).mockReturnValue(qResult({ mutate: vi.fn(), isPending: false }));

    const { NotificationDropdown } = await import('@/features/notifications/NotificationDropdown');
    wrapper(<NotificationDropdown onClose={vi.fn()} />);

    const link = screen.getByText(/view all notifications/i);
    expect(link).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   3 & 4. Notification preferences page
   ══════════════════════════════════════════════════════════════════════ */

describe('InstructorNotificationsPage — preferences', () => {
  it('renders in-app toggle as disabled (always-on)', async () => {
    const { useQuery, useMutation, useInfiniteQuery } = await import('@tanstack/react-query');

    vi.mocked(useInfiniteQuery).mockReturnValue(qResult({
      data: { pages: [] },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useQuery).mockImplementation((opts: any) => {
      const key = opts?.queryKey;
      if (Array.isArray(key) && key[0] === 'notification-preferences') {
        return qResult({
          data: { data: { in_app_enabled: true, email_enabled: false, digest_submissions: false } },
          isLoading: false,
          isError: false,
        });
      }
      return qResult({ data: { data: { unread_count: 0 } }, isLoading: false, isError: false });
    });

    vi.mocked(useMutation).mockReturnValue(qResult({
      mutate: mockUpdatePreferences,
      isPending: false,
    }));

    const InstructorNotificationsPage = (await import('../NotificationsPage')).default;
    wrapper(<InstructorNotificationsPage />);

    const inAppToggle = screen.getByRole('switch', { name: /in-app notifications/i });
    expect(inAppToggle).toBeDisabled();
    expect(inAppToggle).toHaveAttribute('aria-checked', 'true');
  });

  it('fires updatePreferences mutation when email toggle is clicked', async () => {
    const { useQuery, useMutation, useInfiniteQuery } = await import('@tanstack/react-query');

    vi.mocked(useInfiniteQuery).mockReturnValue(qResult({
      data: { pages: [] },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useQuery).mockImplementation((opts: any) => {
      const key = opts?.queryKey;
      if (Array.isArray(key) && key[0] === 'notification-preferences') {
        return qResult({
          data: { data: { in_app_enabled: true, email_enabled: false, digest_submissions: false } },
          isLoading: false,
          isError: false,
        });
      }
      return qResult({ data: { data: { unread_count: 0 } }, isLoading: false, isError: false });
    });

    const updateMutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue(qResult({
      mutate: updateMutate,
      isPending: false,
    }));

    const InstructorNotificationsPage = (await import('../NotificationsPage')).default;
    wrapper(<InstructorNotificationsPage />);

    const emailToggle = screen.getByRole('switch', { name: /email notifications/i });
    fireEvent.click(emailToggle);
    expect(updateMutate).toHaveBeenCalledWith({ email_enabled: true });
  });
});
