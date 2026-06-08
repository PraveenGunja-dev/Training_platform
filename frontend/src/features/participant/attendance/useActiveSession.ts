import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/api/attendance';

export function useActiveSession() {
  return useQuery({
    queryKey: ['attendance', 'active-session'],
    queryFn: attendanceApi.activeSession,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}
