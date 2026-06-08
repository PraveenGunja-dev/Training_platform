import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard', 'participant'],
    queryFn: () => dashboardApi.participant(),
  });
}
