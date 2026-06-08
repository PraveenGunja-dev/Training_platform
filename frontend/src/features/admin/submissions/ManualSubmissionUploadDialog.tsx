import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { submissionsApi } from '@/api/submissions';
import type { GroupParticipant } from '@/lib/types';

const ALLOWED_TYPES = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'video/mp4'];

const schema = z.object({
  participant_id: z.string().min(1, 'Select a participant'),
  file: z.instanceof(File).refine(f => f.size > 0, 'File required'),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  taskId: string;
  participants: GroupParticipant[];
  open: boolean;
  onClose: () => void;
}

export function ManualSubmissionUploadDialog({ taskId, participants, open, onClose }: Props) {
  const qc = useQueryClient();
  const [fileError, setFileError] = useState('');

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: async (vals: FormValues) => {
      const fd = new FormData();
      fd.append('file', vals.file);
      fd.append('note', vals.note ?? '');
      fd.append('submitted_for', vals.participant_id);
      return submissionsApi.submit(taskId, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions', taskId] });
      reset();
      onClose();
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('File type not allowed.');
      return;
    }
    setValue('file', file);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload on Behalf of Participant</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Participant</Label>
            <Select onValueChange={v => setValue('participant_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select participant…" />
              </SelectTrigger>
              <SelectContent>
                {participants.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.participant_id && (
              <p className="text-xs text-red-600">{errors.participant_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>File</Label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4"
              onChange={handleFileChange}
              className="block w-full text-sm text-foreground/90 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-white/15 file:text-xs file:bg-white/5 hover:file:bg-white/8"
            />
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
            {errors.file && <p className="text-xs text-red-600">{errors.file.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <input
              {...register('note')}
              className="w-full border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Uploaded on behalf due to technical issues"
            />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600">Upload failed. Please try again.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
