import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { assignmentsApi } from '@/api/assignments';
import { validateFile } from '@/lib/fileValidation';
import type { AssignmentTask } from '@/lib/types';

export function useUploadSubmission(task: AssignmentTask) {
  const [progress, setProgress] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const validation = validateFile(file);
      if (!validation.ok) throw new Error(validation.error);

      setProgress(0);
      const result = await assignmentsApi.submitAssignment(task.id, file);
      setProgress(100);
      return result;
    },
    onSuccess: () => {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ['my-submission', task.id] });
      void queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'participant'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', task.id] });
      toast.success('Assignment submitted successfully!');
    },
    onError: (err: unknown) => {
      setProgress(null);
      const e = err as { message?: string; response?: { data?: { errors?: Array<{ message: string }> } } };
      const msg = e.message ?? e.response?.data?.errors?.[0]?.message ?? 'Upload failed. Please try again.';
      toast.error(msg);
    },
  });

  return { progress, mutation };
}
