import { Clock, Video, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';
import type { ClassSession } from '@/lib/types';

function StatusBadge({ status }: { status: ClassSession['status'] }) {
  switch (status) {
    case 'UPCOMING': return <Badge variant="info">Upcoming</Badge>;
    case 'ONGOING': return <Badge variant="success">Ongoing</Badge>;
    case 'COMPLETED': return <Badge variant="secondary">Completed</Badge>;
    default: return <Badge variant="destructive">Cancelled</Badge>;
  }
}

export function ClassHeader({ cls }: { cls: ClassSession }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={cls.status} />
              <span className="text-xs text-muted-foreground">{cls.group_name}</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">{cls.title}</h1>
            {cls.description && (
              <p className="text-sm text-muted-foreground">{cls.description}</p>
            )}
          </div>
          <div className="text-sm text-muted-foreground space-y-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground/70" />
              <span>
                {formatDate(cls.starts_at, 'dd MMM yyyy, h:mm a')}
                {' – '}
                {formatDate(cls.ends_at, 'h:mm a')}
              </span>
            </div>
          </div>
        </div>

        {cls.meeting_link && (
          <div className="mt-4 pt-4 border-t border-border">
            <a
              href={cls.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm"
            >
              <Video className="h-4 w-4" />
              Join Meeting
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              Opens in a new tab
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
