import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance';

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, durationMinutes }: { classId: string; durationMinutes: number }) =>
      attendanceApi.admin.startSession(classId, durationMinutes),
    onSuccess: (res, { classId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'attendance', 'sessions'] });
      void qc.invalidateQueries({ queryKey: ['attendance', 'active-session'] });
      void qc.invalidateQueries({ queryKey: ['class', classId] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Attendance started', {
        description: `Email sent to participants of ${res.data.class_title}.`,
      });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { errors?: Array<{ code: string }> } } };
      const code = axiosErr.response?.data?.errors?.[0]?.code;
      if (code === 'attendance.session_already_active') {
        toast.error('A session is already active for this class.');
      } else {
        toast.error('Failed to start attendance.');
      }
    },
  });
}
