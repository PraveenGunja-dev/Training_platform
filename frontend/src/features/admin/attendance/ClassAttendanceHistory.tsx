import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { History, UserCheck, UserX } from 'lucide-react';
import { attendanceApi } from '@/api/attendance';
import { formatDate } from '@/lib/dates';

interface Props {
  classId: string;
  /** Base path for the report link, e.g. '/admin/attendance/sessions' or '/instructor/attendance/sessions' */
  reportBasePath: string;
}

export function ClassAttendanceHistory({ classId, reportBasePath }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'sessions', classId, 'ended'],
    queryFn: () => attendanceApi.admin.listSessions({ class_id: classId, status: 'ENDED' }),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden animate-pulse">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
          <div className="w-7 h-7 rounded-lg bg-[#EBF3FB]" />
          <div className="h-4 w-40 bg-[#EBF3FB] rounded" />
        </div>
        <div className="p-5 space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-[#EBF3FB] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const sessions = data?.data ?? [];
  if (sessions.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-50 flex-shrink-0">
          <History className="h-3.5 w-3.5 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00285A] leading-tight">Attendance History</p>
          <p className="text-xs text-[#5A7A9A]">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded for this class
          </p>
        </div>
      </div>

      {/* Session rows */}
      <div className="divide-y divide-[#EBF3FB]">
        {sessions.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5">

            {/* Session number + time info */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#EBF3FB] text-[10px] font-bold text-[#7C7AAE] flex-shrink-0 tabular-nums">
                {sessions.length - i}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#00285A]">
                  {formatDate(s.started_at, 'dd MMM yyyy')}
                </p>
                <p className="text-xs text-[#5A7A9A]">
                  {formatDate(s.started_at, 'h:mm a')}
                  {s.ended_at ? ` – ${formatDate(s.ended_at, 'h:mm a')}` : ''}
                  {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                </p>
              </div>
            </div>

            {/* Counts + report link */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {s.present_count != null && (
                <>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <UserCheck className="h-3.5 w-3.5" />
                    {s.present_count}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
                    <UserX className="h-3.5 w-3.5" />
                    {s.absent_count ?? 0}
                  </span>
                </>
              )}
              <Link
                to={`${reportBasePath}/${s.id}/report`}
                className="text-xs font-medium text-[#0052A5] hover:text-[#002D6E] hover:underline whitespace-nowrap"
              >
                View Report →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
