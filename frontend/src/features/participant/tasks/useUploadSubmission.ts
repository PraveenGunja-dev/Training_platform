import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submissionsApi } from '@/api/submissions';
import { validateFile } from '@/lib/fileValidation';
import type { AssignmentTask } from '@/lib/types';

export function useUploadSubmission(task: AssignmentTask) {
  const [progress, setProgress] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const validation = validateFile(file);
      if (!validation.ok) throw new Error(validation.error);

      const sasResult = await submissionsApi.getUploadUrl(task.id, {
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
      });

      setProgress(0);
      const putRes = await fetch(sasResult.data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
      setProgress(100);

      return submissionsApi.submit(task.id, {
        blob_name: sasResult.data.blob_name,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
      });
    },
    onSuccess: () => {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ['my-submission', task.id] });
      void queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'participant'] });
      toast.success('Assignment submitted successfully!');
    },
    onError: (err: unknown) => {
      setProgress(null);
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const e = err as { message?: string; response?: { data?: { errors?: Array<{ message: string }> } } };
      const msg = e.message ?? e.response?.data?.errors?.[0]?.message ?? 'Upload failed. Please try again.';
      toast.error(msg);
    },
  });

  return { progress, mutation };
}
