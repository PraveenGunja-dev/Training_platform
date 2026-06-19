import { useQuery } from '@tanstack/react-query';
import {
  CalendarPlus, CalendarCog, Trash2, Play, StopCircle,
  ClipboardList, ClipboardCheck, ClipboardX, Star, ShieldAlert, Loader2,
} from 'lucide-react';
import { classesApi } from '@/api/classes';
import type { AuditEntry } from '@/lib/types';
import { formatDate } from '@/lib/dates';

// ── Human-readable descriptions ────────────────────────────────────────────

function describeEntry(entry: AuditEntry): string {
  const m = entry.metadata as Record<string, unknown>;
  switch (entry.action) {
    case 'class.created':
      return 'Class scheduled';
    case 'class.updated':
      return 'Class details updated';
    case 'class.deleted':
      return 'Class deleted';
    case 'attendance.session_started':
      return 'Attendance session started';
    case 'attendance.session_started_with_drift': {
      const mins = typeof m.delta_minutes === 'number' ? Math.abs(m.delta_minutes) : null;
      const dir = typeof m.delta_minutes === 'number' && m.delta_minutes > 0 ? 'late' : 'early';
      return mins !== null ? `Attendance started ${mins} min ${dir} (timing drift)` : 'Attendance started with timing drift';
    }
    case 'attendance.session_ended':
      return 'Attendance session ended';
    case 'attendance.record_overridden': {
      const from = String(m.old_status ?? '').replace('_', ' ');
      const to   = String(m.new_status ?? '').replace('_', ' ');
      return `Attendance overridden: ${from} → ${to}`;
    }
    case 'assignment.task_created':
      return `Assignment "${m.title ?? 'Untitled'}" allocated`;
    case 'assignment.task_updated':
      return 'Assignment updated';
    case 'assignment.task_closed':
      return `Assignment "${m.title ?? 'Untitled'}" closed`;
    case 'assignment.task_deleted':
      return 'Assignment removed';
    case 'assignment.submission_reviewed': {
      const grade = m.grade_letter ? ` — Grade: ${m.grade_letter}` : '';
      const verb  = m.is_new ? 'reviewed' : 'review updated';
      return `Submission ${verb}${grade}`;
    }
    default:
      return entry.action.replace(/\./g, ' ');
  }
}

// ── Icon per action ─────────────────────────────────────────────────────────

function ActionIcon({ action }: { action: string }) {
  const base = 'h-3.5 w-3.5';
  if (action === 'class.created')   return <CalendarPlus  className={`${base} text-indigo-500`} />;
  if (action === 'class.updated')   return <CalendarCog   className={`${base} text-blue-500`} />;
  if (action === 'class.deleted')   return <Trash2        className={`${base} text-rose-500`} />;
  if (action.startsWith('attendance.session_started'))
                                    return <Play          className={`${base} text-emerald-500`} />;
  if (action === 'attendance.session_ended')
                                    return <StopCircle    className={`${base} text-amber-500`} />;
  if (action === 'attendance.record_overridden')
                                    return <ShieldAlert   className={`${base} text-orange-500`} />;
  if (action === 'assignment.task_created')
                                    return <ClipboardList className={`${base} text-violet-500`} />;
  if (action === 'assignment.task_closed' || action === 'assignment.task_deleted')
                                    return <ClipboardX    className={`${base} text-rose-400`} />;
  if (action === 'assignment.submission_reviewed')
                                    return <Star          className={`${base} text-yellow-500`} />;
  return                                   <ClipboardCheck className={`${base} text-slate-400`} />;
}

function iconBg(action: string): string {
  if (action === 'class.created')                     return 'bg-indigo-50';
  if (action === 'class.updated')                     return 'bg-blue-50';
  if (action === 'class.deleted')                     return 'bg-rose-50';
  if (action.startsWith('attendance.session_started')) return 'bg-emerald-50';
  if (action === 'attendance.session_ended')           return 'bg-amber-50';
  if (action === 'attendance.record_overridden')       return 'bg-orange-50';
  if (action.startsWith('assignment.task'))            return 'bg-violet-50';
  if (action === 'assignment.submission_reviewed')     return 'bg-yellow-50';
  return 'bg-slate-50';
}

// ── Single row ──────────────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: AuditEntry }) {
  const actor = entry.actor
    ? entry.actor.full_name || entry.actor.email
    : 'System';
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#EBF3FB] last:border-0">
      <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg mt-0.5 ${iconBg(entry.action)}`}>
        <ActionIcon action={entry.action} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#00285A] leading-snug">
          {describeEntry(entry)}
        </p>
        <p className="text-xs text-[#5A7A9A] mt-0.5">
          by <span className="font-medium text-[#00285A]">{actor}</span>
          {' · '}
          {formatDate(entry.created_at, 'dd MMM yyyy, h:mm a')}
        </p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ClassActivityLog({ classId }: { classId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['class-activity', classId],
    queryFn: () => classesApi.getActivity(classId),
    staleTime: 30_000,
  });

  const entries = data?.data ?? [];

  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100">
          <ClipboardCheck className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00285A] leading-tight">Activity Log</p>
          <p className="text-xs text-[#5A7A9A]">Attendance, assignments, reviews and status changes</p>
        </div>
      </div>

      <div className="px-5">
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#5A7A9A]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-sm text-[#5A7A9A] text-center">No activity recorded yet.</p>
        ) : (
          entries.map(e => <ActivityRow key={e.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
