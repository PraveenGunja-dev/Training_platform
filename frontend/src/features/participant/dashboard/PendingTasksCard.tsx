import { useNavigate } from 'react-router-dom';
import { ListChecks, ArrowRight, PartyPopper } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import type { AssignmentTask } from '@/lib/types';

function formatCountdown(hours: number, minutes: number, seconds: number): string {
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  if (days > 0) return `${days}d ${hrs}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

function urgency(hours: number): { border: string; time: string; dot: string } {
  if (hours < 24)  return { border: 'border-l-rose-400',   time: 'text-rose-500 font-semibold',  dot: 'bg-rose-400'   };
  if (hours < 72)  return { border: 'border-l-amber-400',  time: 'text-amber-600 font-medium',   dot: 'bg-amber-400'  };
  return               { border: 'border-l-blue-300', time: 'text-[#7C7AAE]',              dot: 'bg-indigo-300' };
}

function TaskRow({ task }: { task: AssignmentTask }) {
  const navigate = useNavigate();
  const remaining = useCountdown(task.deadline_at);
  const u = urgency(remaining.hours);

  return (
    <button
      type="button"
      onClick={() => navigate(`/me/tasks/${task.id}`)}
      className={`flex items-center justify-between w-full text-left py-2.5 pl-3 pr-2 rounded-lg border-l-[3px] ${u.border} bg-[#FAFAFE] hover:bg-[#EBF3FB] transition-colors group`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.dot}`} />
        <span className="text-sm font-medium text-[#00285A] truncate">{task.title}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <span className={`text-xs ${u.time}`}>
          {formatCountdown(remaining.hours, remaining.minutes, remaining.seconds)}
        </span>
        <ArrowRight className="h-3 w-3 text-[#5A7A9A] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

export function PendingTasksCard({ tasks }: { tasks: AssignmentTask[] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 text-amber-500">
          <ListChecks className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00285A] leading-tight">Pending Tasks</p>
          <p className="text-xs text-[#5A7A9A]">{tasks.length} task{tasks.length !== 1 ? 's' : ''} remaining</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <PartyPopper className="h-8 w-8 text-emerald-400" />
            <p className="text-sm font-medium text-[#00285A]">All caught up!</p>
            <p className="text-xs text-[#5A7A9A]">No pending tasks right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 4).map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
