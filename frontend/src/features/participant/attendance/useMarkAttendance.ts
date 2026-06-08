import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance';

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => attendanceApi.mark(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance', 'active-session'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'participant'] });
      toast.success('Attendance marked!', { description: 'You are present.' });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { errors?: Array<{ code: string }> } } };
      const code = e.response?.data?.errors?.[0]?.code ?? '';
      const map: Record<string, string> = {
        'attendance.already_marked': 'You have already marked attendance.',
        'attendance.session_ended': 'The session has ended.',
        'perm.not_in_group': 'You are not part of this group.',
      };
      toast.error(map[code] ?? 'Failed to mark attendance.');
    },
  });
}
