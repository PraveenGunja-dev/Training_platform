import { formatDate } from '@/lib/dates';
import { differenceInDays } from 'date-fns';

interface DeadlineEntry {
  task_title: string;
  deadline_at: string;
  pending_count: number;
}

interface DeadlineTrackingChartProps {
  data: DeadlineEntry[];
}

function urgencyStyle(deadline_at: string): { bar: string; badge: string; label: string } {
  const days = differenceInDays(new Date(deadline_at), new Date());
  if (days <= 1)  return { bar: 'bg-rose-500',   badge: 'bg-rose-50 text-rose-600 border-rose-200',   label: 'Urgent'  };
  if (days <= 3)  return { bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200', label: `${days}d` };
  return            { bar: 'bg-indigo-400',  badge: 'bg-blue-50 text-[#0052A5] border-blue-200', label: `${days}d` };
}

export function DeadlineTrackingChart({ data }: DeadlineTrackingChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[#5A7A9A] text-sm">
        No upcoming deadlines.
      </div>
    );
  }

  const maxPending = Math.max(...data.map(d => d.pending_count), 1);

  return (
    <div className="space-y-3.5">
      {data.map(entry => {
        const fraction = entry.pending_count / maxPending;
        const u = urgencyStyle(entry.deadline_at);
        return (
          <div key={entry.task_title + entry.deadline_at}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[#00285A] truncate max-w-[55%] leading-tight">
                {entry.task_title}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-[#5A7A9A]">
                  {entry.pending_count} pending
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${u.badge}`}>
                  {u.label === 'Urgent' ? '🔴 Urgent' : `due ${formatDate(entry.deadline_at, 'dd MMM')}`}
                </span>
              </div>
            </div>
            <div className="h-2 bg-[#EBF3FB] rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${u.bar}`}
                style={{ width: `${Math.max(fraction * 100, 3)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
