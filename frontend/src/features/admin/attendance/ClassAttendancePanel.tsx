import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, UserX, Radio } from 'lucide-react';
import { attendanceApi } from '@/api/attendance';
import { formatDate } from '@/lib/dates';
import type { AttendanceSession } from '@/lib/types';

interface Props {
  activeSession: AttendanceSession | null;
}

export function ClassAttendancePanel({ activeSession }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'attendance', 'report', activeSession?.id],
    queryFn: () => attendanceApi.admin.sessionReport(activeSession!.id),
    enabled: !!activeSession?.id,
    refetchInterval: activeSession?.status === 'ACTIVE' ? 10_000 : false,
    staleTime: 0,
  });

  /* ── No session ──────────────────────────────────────────────────── */
  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 mb-3">
          <Radio className="h-6 w-6 text-teal-300" />
        </div>
        <p className="text-sm font-medium text-slate-600">No active attendance session</p>
        <p className="text-xs text-slate-400 mt-1">
          Click <span className="font-semibold text-teal-600">Start Attendance</span> above to begin tracking.
        </p>
      </div>
    );
  }

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
        </div>
        {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
      </div>
    );
  }

  const report = data?.data;
  if (!report) return null;

  const present = report.records.filter(r => r.status === 'PRESENT');
  const absent  = report.records.filter(r => r.status === 'ABSENT');

  return (
    <div className="space-y-4">

      {/* ── Summary strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-slate-50 border border-slate-200 py-3">
          <p className="text-xs text-slate-400 font-medium mb-0.5">Total</p>
          <p className="text-2xl font-bold text-slate-700 tabular-nums">{report.summary.total}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 py-3">
          <p className="text-xs text-emerald-500 font-medium mb-0.5">Present</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{report.summary.present}</p>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-200 py-3">
          <p className="text-xs text-rose-400 font-medium mb-0.5">Absent</p>
          <p className="text-2xl font-bold text-rose-600 tabular-nums">{report.summary.absent}</p>
        </div>
      </div>

      {/* ── Present list ─────────────────────────────────────────────── */}
      {present.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Present</p>
          <div className="space-y-1">
            {present.map(r => (
              <div key={r.user.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700">{r.user.full_name}</span>
                </div>
                {r.marked_at && (
                  <span className="text-xs text-emerald-600 font-medium tabular-nums">
                    {formatDate(r.marked_at, 'h:mm a')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Absent / not yet marked list ─────────────────────────────── */}
      {absent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Not yet marked</p>
          <div className="space-y-1">
            {absent.map(r => (
              <div key={r.user.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                <UserX className="h-4 w-4 text-slate-300 flex-shrink-0" />
                <span className="text-sm text-slate-400">{r.user.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full report link ─────────────────────────────────────────── */}
      <div className="pt-1 border-t border-slate-100">
        <Link
          to={`/admin/attendance/sessions/${activeSession.id}/report`}
          className="text-xs text-[#0052A5] hover:underline font-medium"
        >
          View full report →
        </Link>
      </div>
    </div>
  );
}
