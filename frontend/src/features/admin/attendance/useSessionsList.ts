import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/api/attendance';
import type { SessionsListFilter } from '@/lib/types';

export function useSessionsList(filter?: SessionsListFilter) {
  return useQuery({
    queryKey: ['admin', 'attendance', 'sessions', filter],
    queryFn: () => attendanceApi.admin.listSessions(filter),
  });
}
