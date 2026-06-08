import { Badge } from '@/components/ui/badge';

interface AttendanceStateBadgeProps {
  status: 'PRESENT' | 'ABSENT' | 'PENDING';
  markedAt?: string | null;
}

export function AttendanceStateBadge({ status, markedAt }: AttendanceStateBadgeProps) {
  if (status === 'PRESENT') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success">Present</Badge>
        {markedAt && (
          <span className="text-xs font-mono text-foreground/60">
            {new Date(markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        )}
      </div>
    );
  }
  if (status === 'ABSENT') {
    return <Badge variant="destructive">Absent</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}
