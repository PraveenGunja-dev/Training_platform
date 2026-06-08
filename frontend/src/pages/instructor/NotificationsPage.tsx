import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Mail, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationsApi } from '@/api/notifications';
import { NotificationItem } from '@/features/notifications/NotificationItem';
import { useMarkRead, useMarkAllRead } from '@/features/notifications/useNotifications';
import { ErrorState } from '@/components/states/ErrorState';

function PreferencesCard() {
  const queryClient = useQueryClient();

  const { data: prefsData, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsApi.getPreferences,
  });
  const prefs = prefsData?.data;

  const updateMutation = useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  if (isLoading || !prefs) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-sm">Notification Preferences</h2>
      </div>
      <div className="px-6 py-4 space-y-4">
        {/* In-app — always on, read-only */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <Bell className="h-4 w-4 text-[#0066BB]" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">In-app notifications</p>
              <p className="text-xs text-slate-500">Always enabled</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked="true"
            aria-label="In-app notifications"
            disabled
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[#0052A5] opacity-60 transition-colors"
          >
            <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform" />
          </button>
        </div>

        {/* Email notifications */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <Mail className="h-4 w-4 text-[#0066BB]" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Email notifications</p>
              <p className="text-xs text-slate-500">Receive alerts via email</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.email_enabled}
            aria-label="Email notifications"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ email_enabled: !prefs.email_enabled })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              prefs.email_enabled ? 'bg-[#0052A5]' : 'bg-slate-200'
            } disabled:opacity-60`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              prefs.email_enabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Digest submissions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <Upload className="h-4 w-4 text-[#0066BB]" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Digest submissions</p>
              <p className="text-xs text-slate-500">Get one daily summary instead of per-submission alerts</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.digest_submissions}
            aria-label="Digest submissions"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ digest_submissions: !prefs.digest_submissions })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              prefs.digest_submissions ? 'bg-[#0052A5]' : 'bg-slate-200'
            } disabled:opacity-60`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              prefs.digest_submissions ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstructorNotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const markRead    = useMarkRead();
  const markAllRead = useMarkAllRead();
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  }, [queryClient]);

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  notificationsApi.unreadCount,
  });
  const unreadCount = countData?.data.unread_count ?? 0;

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, refetch,
  } = useInfiniteQuery({
    queryKey: ['notifications', 'infinite', { unreadOnly }],
    queryFn:  ({ pageParam }) =>
      notificationsApi.list({
        cursor:      pageParam as string | undefined,
        unread_only: unreadOnly,
        limit:       20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      (lastPage.meta?.next_cursor as string | undefined) ?? undefined,
  });

  const items = data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
            <Bell className="h-5 w-5 text-[#0052A5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Notifications</h1>
            <p className="text-sm text-slate-500">Events across your assigned groups.</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || unreadCount === 0}
          className="text-slate-600 border-slate-200 hover:bg-slate-50"
        >
          Mark all read
        </Button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setUnreadOnly(false)}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px ${
            !unreadOnly
              ? 'border-indigo-600 text-[#0052A5]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setUnreadOnly(true)}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px ${
            unreadOnly
              ? 'border-indigo-600 text-[#0052A5]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold ${
              unreadOnly
                ? 'bg-[#0052A5] text-white'
                : 'bg-blue-100 text-[#0052A5]'
            }`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Notifications card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true" aria-label="Loading notifications…">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load notifications" onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 mb-4">
              <BellOff className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
            </p>
            {unreadOnly && (
              <button
                className="mt-2 text-sm text-[#0052A5] hover:underline font-medium"
                onClick={() => setUnreadOnly(false)}
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={(id) => markRead.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      {/* ── Preferences ── */}
      <PreferencesCard />
    </div>
  );
}
