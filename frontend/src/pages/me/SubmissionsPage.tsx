import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileCheck2 } from 'lucide-react';
import { submissionsApi } from '@/api/submissions';
import { assignmentsApi } from '@/api/assignments';
import { SubmissionRow } from '@/features/participant/submissions/SubmissionRow';
import { ErrorState } from '@/components/states/ErrorState';
import type { SubmissionStatus } from '@/lib/types';

type StatusFilter = '' | SubmissionStatus;

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: 'Submitted',
  LATE_SUBMITTED: 'Late Submitted',
  OVERRIDE_BY_ADMIN: 'Override',
};

const STATUS_CHIP: Record<SubmissionStatus, string> = {
  SUBMITTED:        'bg-emerald-50 text-emerald-700 border border-emerald-100',
  LATE_SUBMITTED:   'bg-amber-50 text-amber-700 border border-amber-100',
  OVERRIDE_BY_ADMIN:'bg-blue-50 text-[#0052A5] border border-indigo-100',
};

export default function SubmissionsPage() {
  const [taskFilter, setTaskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const { data: subsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: () => submissionsApi.mySubmissions({ sort: '-submitted_at' }),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => assignmentsApi.myTasks(),
  });

  const taskMap = useMemo(
    () => new Map((tasksData?.data ?? []).map(t => [t.id, t])),
    [tasksData],
  );

  const submissions = useMemo(() => subsData?.data ?? [], [subsData]);

  const filtered = useMemo(() => {
    let items = [...submissions];
    if (taskFilter)    items = items.filter(s => s.task_id === taskFilter);
    if (statusFilter)  items = items.filter(s => s.status === statusFilter);
    return items;
  }, [submissions, taskFilter, statusFilter]);

  const submittedTaskIds = useMemo(
    () => [...new Set(submissions.map(s => s.task_id))],
    [submissions],
  );

  const counts = useMemo(() => ({
    total:          submissions.length,
    submitted:      submissions.filter(s => s.status === 'SUBMITTED').length,
    late:           submissions.filter(s => s.status === 'LATE_SUBMITTED').length,
    override:       submissions.filter(s => s.status === 'OVERRIDE_BY_ADMIN').length,
  }), [submissions]);

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 flex-shrink-0">
          <Upload className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">My Submissions</h1>
          <p className="text-sm text-slate-500">All files you have submitted for assignment tasks.</p>
        </div>
      </div>

      {/* ── Table card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Emerald accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

        {/* Card header with stats + filters */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 space-y-3">

          {/* Stats strip */}
          {!isLoading && !isError && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Total</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {counts.total}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CHIP.SUBMITTED}`}>
                {counts.submitted} Submitted
              </span>
              {counts.late > 0 && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CHIP.LATE_SUBMITTED}`}>
                  {counts.late} Late
                </span>
              )}
              {counts.override > 0 && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CHIP.OVERRIDE_BY_ADMIN}`}>
                  {counts.override} Override
                </span>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={taskFilter}
              onChange={e => setTaskFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">All Tasks</option>
              {submittedTaskIds.map(tid => (
                <option key={tid} value={tid}>
                  {taskMap.get(tid)?.title ?? tid}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">All Statuses</option>
              {(Object.keys(STATUS_LABELS) as SubmissionStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>

            {(taskFilter || statusFilter) && (
              <button
                className="text-sm text-slate-400 hover:text-slate-600 font-medium px-2"
                onClick={() => { setTaskFilter(''); setStatusFilter(''); }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true" aria-label="Loading submissions…">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load submissions" onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
              <FileCheck2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-slate-600 font-medium">
              {submissions.length === 0
                ? 'You have not submitted anything yet.'
                : 'No submissions match your filters.'}
            </p>
            {(taskFilter || statusFilter) && (
              <button
                className="mt-2 text-sm text-[#0052A5] hover:underline font-medium"
                onClick={() => { setTaskFilter(''); setStatusFilter(''); }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Task</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">File</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Submitted At</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Grade</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filtered.map(sub => (
                    <SubmissionRow
                      key={sub.id}
                      submission={sub}
                      task={taskMap.get(sub.task_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-400 text-right">
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
