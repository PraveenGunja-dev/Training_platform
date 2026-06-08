import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ClipboardList, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assignmentsApi } from '@/api/assignments';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { SubmissionsTable } from '@/features/admin/submissions/SubmissionsTable';
import type { ApiEnvelope, AssignmentTask, GroupDetail, GroupParticipant, LatePolicy } from '@/lib/types';

const LATE_POLICY_BADGE: Record<LatePolicy, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' }> = {
  STRICT: { label: 'Strict', variant: 'secondary' },
  LATE_ALLOWED: { label: 'Late Allowed', variant: 'warning' },
  ADMIN_ONLY: { label: 'Admin Only', variant: 'info' },
};

interface TaskRowProps {
  task: AssignmentTask;
  participants: GroupParticipant[];
}

function TaskRow({ task, participants }: TaskRowProps) {
  const [open, setOpen] = useState(false);
  const pb = LATE_POLICY_BADGE[task.late_policy];
  const isPast = new Date(task.deadline_at) < new Date();
  const isOpen = task.is_open && !task.is_closed;

  return (
    <div className="border border-[#C5D8EC] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white hover:bg-[#F8F7FF] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg ${open ? 'bg-blue-100' : 'bg-[#EBF3FB]'}`}>
            <ClipboardList className={`h-3.5 w-3.5 ${open ? 'text-[#0052A5]' : 'text-blue-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#00285A] truncate">{task.title}</p>
            <p className="text-xs text-[#5A7A9A]">
              Deadline: {formatDate(task.deadline_at, 'dd MMM yyyy, h:mm a')}
              {isPast && <span className="ml-1.5 text-rose-400">(Passed)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOpen ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Open
            </span>
          ) : task.is_closed ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EBF3FB] text-[#7C7AAE] border border-[#C5D8EC]">Closed</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Locked</span>
          )}
          <Badge variant={pb.variant}>{pb.label}</Badge>
          <Link
            to={`/admin/assignments/${task.id}/submissions`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-[#0066BB] hover:text-[#0052A5] transition-colors"
            title="Open full review page"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
          {open
            ? <ChevronDown className="h-4 w-4 text-[#5A7A9A]" />
            : <ChevronRight className="h-4 w-4 text-[#5A7A9A]" />
          }
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-[#EBF3FB] bg-[#F8F7FF]">
          <SubmissionsTable
            taskId={task.id}
            latePolicy={task.late_policy}
            participants={participants}
          />
        </div>
      )}
    </div>
  );
}

interface Props {
  classId: string;
  groupId: string;
}

export function ClassSubmissionsPanel({ classId, groupId }: Props) {
  const tasksQuery = useQuery({
    queryKey: ['assignments', { class_id: classId }],
    queryFn: () => assignmentsApi.listByClass(classId),
    enabled: !!classId,
  });

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () =>
      apiClient.get<ApiEnvelope<GroupDetail>>(`/groups/${groupId}`).then(r => r.data),
    enabled: !!groupId,
  });

  const tasks = tasksQuery.data?.data ?? [];
  const participants = groupQuery.data?.data?.participants ?? [];

  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50">
            <ClipboardList className="h-3.5 w-3.5 text-[#0066BB]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#00285A] leading-tight">Assignment Submissions</p>
            <p className="text-xs text-[#5A7A9A]">
              {tasksQuery.isLoading
                ? 'Loading…'
                : tasks.length === 0
                  ? 'No assignments linked to this class'
                  : `${tasks.length} assignment${tasks.length === 1 ? '' : 's'} linked — click to expand`}
            </p>
          </div>
        </div>
        {tasks.length > 0 && (
          <span className="text-xs text-[#5A7A9A] font-medium px-2 py-0.5 bg-[#EBF3FB] rounded-full">
            {tasks.length}
          </span>
        )}
      </div>

      <div className="p-5">
        {tasksQuery.isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-[#EBF3FB] rounded-xl" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#5A7A9A]">
            <FileText className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No assignments have been allocated to this class.</p>
            <p className="text-xs mt-0.5">Use "Allocate Assignment" above to link one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} participants={participants} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
