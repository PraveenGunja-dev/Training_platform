import { Badge } from '@/components/ui/badge';
import type { AttendanceSessionStatus } from '@/lib/types';

export function SessionStatusBadge({ status }: { status: AttendanceSessionStatus }) {
  if (status === 'ACTIVE') {
    return (
      <Badge className="bg-brand-teal/20 text-brand-teal border border-brand-teal/30 animate-pulse gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-teal inline-block" />
        Live
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Completed
    </Badge>
  );
}
