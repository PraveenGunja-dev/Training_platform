import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/api/attendance';

export function useSessionReport(sessionId: string) {
  return useQuery({
    queryKey: ['admin', 'attendance', 'report', sessionId],
    queryFn: () => attendanceApi.admin.sessionReport(sessionId),
    enabled: !!sessionId,
  });
}
