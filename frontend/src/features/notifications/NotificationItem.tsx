import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Clock,
  FileText,
  CheckCircle,
  CalendarDays,
  UserCheck,
  AlertCircle,
  Users,
  FolderOpen,
  ClipboardList,
  RefreshCw,
  UserMinus,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatRelative } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/lib/types';

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  DEADLINE_REMINDER:              Clock,
  TASK_OPENED:                    FileText,
  SHARED_DOC_RESULT:              CheckCircle,
  CLASS_SCHEDULED:                CalendarDays,
  CLASS_STARTING_SOON:            CalendarDays,
  CLASS_RESCHEDULED:              RefreshCw,
  CLASS_DOCUMENT_ADDED:           FolderOpen,
  CLASS_TASK_ASSIGNED:            ClipboardList,
  ATTENDANCE_OVERRIDE:            UserCheck,
  INVITE_RESENT:                  AlertCircle,
  ATTENDANCE_SESSION_STARTED:     CalendarDays,
  ATTENDANCE_SESSION_ENDED:       CalendarDays,
  ATTENDANCE_CLOSING_SOON:        Clock,
  GROUP_ADDED:                    Users,
  // Instructor notification icons
  GROUP_ASSIGNED:                 Users,
  GROUP_UNASSIGNED:               UserMinus,
  CO_INSTRUCTOR_ADDED:            Users,
  CLASS_SCHEDULED_BY_ADMIN:       CalendarDays,
  CLASS_CANCELLED:                AlertCircle,
  CO_INSTRUCTOR_EDITED_CLASS:     RefreshCw,
  ASSIGNMENT_CREATED_IN_GROUP:    ClipboardList,
  SUBMISSION_RECEIVED:            FileText,
  DEADLINE_APPROACHING:           Clock,
  ATTENDANCE_SESSION_REMINDER:    Bell,
  PARTICIPANTS_ADDED_TO_GROUP:    Users,
  PARTICIPANTS_REMOVED_FROM_GROUP: UserMinus,
  SHARED_UPLOAD_PENDING:          Upload,
  SUBMISSION_REVIEWED:            CheckCircle,
  GROUP_ADMIN_ASSIGNED:           Users,
};

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const navigate = useNavigate();
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  const isUnread = !notification.read_at;

  const handleClick = () => {
    if (isUnread) onRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors',
        isUnread && 'bg-primary/5',
      )}
    >
      <div className="mt-0.5 flex-shrink-0">
        <Icon
          className={cn('h-4 w-4', isUnread ? 'text-primary' : 'text-muted-foreground/70')}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-tight',
              isUnread ? 'font-semibold text-foreground' : 'font-normal text-foreground/90',
            )}
          >
            {notification.title}
          </p>
          {isUnread && (
            <span
              className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{notification.body}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">{formatRelative(notification.created_at)}</p>
      </div>
    </button>
  );
}
