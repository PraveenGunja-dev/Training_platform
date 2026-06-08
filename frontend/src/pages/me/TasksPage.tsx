import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, CheckCircle2, Unlock, Lock } from 'lucide-react';
import { assignmentsApi } from '@/api/assignments';
import { submissionsApi } from '@/api/submissions';
import { groupsApi } from '@/api/groups';
import { TaskCard } from '@/features/participant/tasks/TaskCard';
import { deriveTaskState } from '@/features/participant/tasks/TaskStateBadge';
import { ErrorState } from '@/components/states/ErrorState';
import type { ParticipantTaskState } from '@/features/participant/tasks/TaskStateBadge';

type FilterState = 'ALL' | 'OPEN' | 'SUBMITTED' | 'CLOSED' | 'LOCKED';

const FILTERS: FilterState[] = ['ALL', 'OPEN', 'SUBMITTED', 'CLOSED', 'LOCKED'];

const FILTER_CONFIG: Record<FilterState, { label: string; active: string; inactive: string }> = {
  ALL:       { label: 'All',       active: 'bg-[#0052A5] text-white',                      inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200'       },
  OPEN:      { label: 'Open',      active: 'bg-emerald-500 text-white',                     inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'  },
  SUBMITTED: { label: 'Submitted', active: 'bg-sky-500 text-white',                         inactive: 'bg-sky-50 text-sky-700 hover:bg-sky-100'              },
  CLOSED:    { label: 'Closed',    active: 'bg-slate-500 text-white',                       inactive: 'bg-slate-100 text-slate-500 hover:bg-slate-200'       },
  LOCKED:    { label: 'Locked',    active: 'bg-amber-500 text-white',                       inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100'        },
};

function stateMatchesFilter(state: ParticipantTaskState, filter: FilterState): boolean {
  if (filter === 'ALL')       return true;
  if (filter === 'OPEN')      return state === 'OPEN' || state === 'LATE_OPEN';
  if (filter === 'SUBMITTED') return state === 'SUBMITTED' || state === 'LATE_SUBMITTED';
  if (filter === 'CLOSED')    return state === 'CLOSED';
  if (filter === 'LOCKED')    return state === 'LOCKED';
  return false;
}

const SORT_PRIORITY: Record<ParticipantTaskState, number> = {
  LATE_OPEN: 0, OPEN: 1, LATE_SUBMITTED: 2, SUBMITTED: 3, CLOSED: 4, LOCKED: 5,
};

export default function TasksPage() {
  const [activeFilter, setActiveFilter] = useState<FilterState>('ALL');

  const { data: tasksData, isLoading: tasksLoading, isError: tasksError, refetch: tasksRefetch } = useQuery({
    queryKey: ['my-tasks'],
    queryFn:  () => assignmentsApi.myTasks(),
  });

  const { data: subsData } = useQuery({
    queryKey: ['my-submissions'],
    queryFn:  () => submissionsApi.mySubmissions(),
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn:  () => groupsApi.list(),
  });

  const groupMap = useMemo(
    () => new Map((groupsData?.data ?? []).map(g => [g.id, g.name])),
    [groupsData],
  );

  const tasksWithState = useMemo(() => {
    const tasks = tasksData?.data ?? [];
    const subs  = subsData?.data  ?? [];
    return tasks.map(task => {
      const taskSubs    = subs.filter(s => s.task_id === task.id);
      const hasSubmission = taskSubs.length > 0;
      const latestSub   = taskSubs.reduce<typeof taskSubs[0] | undefined>((prev, cur) =>
        !prev || cur.version > prev.version ? cur : prev, undefined);
      const state = deriveTaskState(task, hasSubmission, latestSub?.status);
      return { task, state };
    });
  }, [tasksData, subsData]);

  const filtered = useMemo(() =>
    tasksWithState
      .filter(({ state }) => stateMatchesFilter(state, activeFilter))
      .sort((a, b) => {
        const pd = SORT_PRIORITY[a.state] - SORT_PRIORITY[b.state];
        if (pd !== 0) return pd;
        return new Date(a.task.deadline_at).getTime() - new Date(b.task.deadline_at).getTime();
      }),
    [tasksWithState, activeFilter],
  );

  const countPerFilter = useMemo(() => {
    const counts: Record<FilterState, number> = { ALL: 0, OPEN: 0, SUBMITTED: 0, CLOSED: 0, LOCKED: 0 };
    tasksWithState.forEach(({ state }) => {
      counts.ALL++;
      FILTERS.slice(1).forEach(f => { if (stateMatchesFilter(state, f)) counts[f]++; });
    });
    return counts;
  }, [tasksWithState]);

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 flex-shrink-0">
          <ListChecks className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">My Tasks</h1>
          <p className="text-sm text-slate-500">All assignment tasks assigned to you.</p>
        </div>
      </div>

      {/* ── Stats summary ────────────────────────────────────────────── */}
      {!tasksLoading && !tasksError && tasksWithState.length > 0 && (
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            {countPerFilter.SUBMITTED} submitted
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1.5 text-[#0052A5] font-medium">
            <Unlock className="h-4 w-4" />
            {countPerFilter.OPEN} open
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Lock className="h-4 w-4" />
            {countPerFilter.LOCKED} locked
          </span>
        </div>
      )}

      {/* ── Filter chips ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => {
          const cfg = FILTER_CONFIG[f];
          const isActive = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                isActive ? cfg.active : cfg.inactive
              }`}
            >
              {cfg.label}
              {countPerFilter[f] > 0 && (
                <span className={`text-xs tabular-nums rounded-full px-1.5 py-0 font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/60 text-current'
                }`}>
                  {countPerFilter[f]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Task list ────────────────────────────────────────────────── */}
      {tasksLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading tasks…">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasksError ? (
        <ErrorState title="Failed to load tasks" onRetry={() => void tasksRefetch()} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 mb-4">
            <ListChecks className="h-7 w-7 text-amber-400" />
          </div>
          <p className="text-slate-600 font-medium">
            {activeFilter === 'ALL' ? 'No tasks assigned yet.' : `No ${FILTER_CONFIG[activeFilter].label.toLowerCase()} tasks.`}
          </p>
          {activeFilter !== 'ALL' && (
            <button
              className="mt-2 text-sm text-[#0052A5] hover:underline font-medium"
              onClick={() => setActiveFilter('ALL')}
            >
              View all tasks
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ task, state }) => (
            <TaskCard
              key={task.id}
              task={task}
              state={state}
              groupName={groupMap.get(task.group_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
