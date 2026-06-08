import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useNotifications, useMarkAllRead, useMarkRead } from './useNotifications';
import { NotificationItem } from './NotificationItem';
import { useAuthStore } from '@/store/auth';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const rolePrefix = user?.role === 'ADMIN' ? '/admin' : user?.role === 'INSTRUCTOR' ? '/instructor' : '/me';

  const { data, isPending, isError } = useNotifications({ limit: 20 });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.data ?? [];

  const handleViewAll = () => {
    navigate(`${rolePrefix}/notifications`);
    onClose();
  };

  return (
    <div className="flex flex-col" role="dialog" aria-label="Notifications">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          Mark all read
        </Button>
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
        {isPending && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground/70">Loading...</p>
        )}
        {!isPending && isError && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground/70">Could not load notifications.</p>
        )}
        {!isPending && !isError && notifications.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground/70">No notifications yet</p>
        )}
        {notifications.map(n => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={(id) => markRead.mutate(id)}
          />
        ))}
      </div>

      <div className="border-t px-4 py-2.5">
        <button
          type="button"
          onClick={handleViewAll}
          className="text-xs font-medium text-primary hover:text-primary transition-colors"
        >
          View all notifications →
        </button>
      </div>
    </div>
  );
}
