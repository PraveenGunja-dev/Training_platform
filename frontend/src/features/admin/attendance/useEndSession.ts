import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance';

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => attendanceApi.admin.endSession(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'attendance', 'sessions'] });
      void qc.invalidateQueries({ queryKey: ['attendance', 'active-session'] });
      void qc.invalidateQueries({ queryKey: ['class'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Attendance ended.');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { errors?: Array<{ code: string }> } } };
      const code = axiosErr.response?.data?.errors?.[0]?.code;
      if (code === 'attendance.session_already_ended') {
        toast.error('This session has already been ended.');
      } else {
        toast.error('Failed to end attendance.');
      }
    },
  });
}
