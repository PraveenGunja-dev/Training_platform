import { Link } from 'react-router-dom';
import { Clock, ChevronRight, AlertTriangle, CheckCircle2, Unlock, Lock, XCircle, AlertCircle } from 'lucide-react';
import { TaskStateBadge } from './TaskStateBadge';
import { formatDate, formatRelative } from '@/lib/dates';
import type { ParticipantTaskState } from './TaskStateBadge';
import type { AssignmentTask } from '@/lib/types';

interface TaskCardProps {
  task: AssignmentTask;
  state: ParticipantTaskState;
  groupName?: string;
}

const STATE_STYLE: Record<ParticipantTaskState, {
  headerBg: string;
  iconColor: string;
  Icon: React.ElementType;
  borderColor: string;
}> = {
  OPEN:           { headerBg: 'bg-emerald-50',  iconColor: 'text-emerald-600', Icon: Unlock,       borderColor: 'border-emerald-200' },
  LATE_OPEN:      { headerBg: 'bg-amber-50',    iconColor: 'text-amber-600',   Icon: AlertTriangle, borderColor: 'border-amber-200'   },
  SUBMITTED:      { headerBg: 'bg-sky-50',      iconColor: 'text-sky-600',     Icon: CheckCircle2, borderColor: 'border-sky-200'     },
  LATE_SUBMITTED: { headerBg: 'bg-amber-50',    iconColor: 'text-amber-500',   Icon: AlertCircle,  borderColor: 'border-amber-200'   },
  CLOSED:         { headerBg: 'bg-slate-50',    iconColor: 'text-slate-500',   Icon: XCircle,      borderColor: 'border-slate-200'   },
  LOCKED:         { headerBg: 'bg-slate-50',    iconColor: 'text-slate-400',   Icon: Lock,         borderColor: 'border-slate-200'   },
};

export function TaskCard({ task, state, groupName }: TaskCardProps) {
  const deadline = new Date(task.deadline_at);
  const now = new Date();
  const isUpcoming = deadline > now;
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isDueSoon = isUpcoming && hoursLeft < 24 && (state === 'OPEN' || state === 'LATE_OPEN');

  const { headerBg, iconColor, Icon, borderColor } = STATE_STYLE[state];

  return (
    <Link to={`/me/tasks/${task.id}`} className="block group">
      <div className={`rounded-xl border ${borderColor} overflow-hidden shadow-sm hover:shadow-md transition-all duration-150`}>

        {/* ── Coloured header ─────────────────────────────────────────── */}
        <div className={`${headerBg} px-4 py-3 flex items-center gap-3`}>
          <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
          <h3 className="flex-1 font-semibold text-slate-800 truncate text-[15px]">{task.title}</h3>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="bg-white px-4 py-3 space-y-2.5">

          {/* chips row */}
          <div className="flex items-center gap-2 flex-wrap">
            <TaskStateBadge state={state} />
            {groupName && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {groupName}
              </span>
            )}
            {isDueSoon && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                Due soon
              </span>
            )}
          </div>

          {/* question preview */}
          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{task.question}</p>

          {/* deadline footer */}
          <div className={`flex items-center gap-1.5 text-xs font-medium ${isDueSoon ? 'text-amber-600' : 'text-slate-400'}`}>
            <Clock className="h-3.5 w-3.5" />
            {isUpcoming
              ? <span>Due {formatRelative(task.deadline_at)}</span>
              : <span>{formatDate(task.deadline_at, 'dd MMM yyyy')}</span>
            }
          </div>
        </div>
      </div>
    </Link>
  );
}
