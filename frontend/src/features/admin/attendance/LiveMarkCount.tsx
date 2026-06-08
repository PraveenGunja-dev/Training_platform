import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { attendanceApi } from '@/api/attendance';

export function LiveMarkCount({ sessionId }: { sessionId: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'attendance', 'report', sessionId],
    queryFn: () => attendanceApi.admin.sessionReport(sessionId),
    enabled: !!sessionId,
    refetchInterval: 10_000,
    staleTime: 0,
  });

  const summary = data?.data?.summary;

  if (!summary) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400">
        <Users className="h-3 w-3" />
        —
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
      <Users className="h-3 w-3" />
      {summary.present} / {summary.total} marked
    </span>
  );
}
