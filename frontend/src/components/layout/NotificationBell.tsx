import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { notificationsApi } from '@/api/notifications';
import { NotificationDropdown } from '@/features/notifications/NotificationDropdown';
import { useAuthStore } from '@/store/auth';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  const count = data?.data.unread_count ?? 0;

  // Force-refetch the notification list every time the dropdown is opened
  // so stale or previously-failed list queries always show fresh data.
  useEffect(() => {
    if (open) {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    }
  }, [open, queryClient]);

  // When a new notification arrives, refresh participant-facing data so changes
  // (e.g. added to a group, document approved/rejected) appear immediately.
  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'calendar'] });
    }
    prevCountRef.current = count;
  }, [count, queryClient]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications (${count} unread)`}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-semibold"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <NotificationDropdown onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
