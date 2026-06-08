import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { documentsApi } from '@/api/documents';
import type { ParticipantSharedDoc } from '@/lib/types';

interface Props {
  upload: ParticipantSharedDoc | null;
  open: boolean;
  onClose: () => void;
}

export function RejectDialog({ upload, open, onClose }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const reasonError = touched && reason.trim().length < 5 ? 'Reason must be at least 5 characters.' : '';

  const mutation = useMutation({
    mutationFn: () => documentsApi.rejectSharedUpload(upload!.id, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-uploads-pending'] });
      qc.invalidateQueries({ queryKey: ['my-shared-uploads'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      setReason('');
      setTouched(false);
      onClose();
    },
  });

  function handleSubmit() {
    setTouched(true);
    if (reason.trim().length < 5) return;
    mutation.mutate();
  }

  if (!upload) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setReason(''); setTouched(false); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Upload</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm space-y-1">
            <p className="font-semibold text-slate-800">{upload.title || upload.file_name}</p>
            <p className="text-slate-400 text-xs">{upload.file_name}</p>
          </div>

          <div className="space-y-1.5">
            <Label>
              Rejection Reason <span className="text-red-500">*</span>
            </Label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              placeholder="Explain why this document is being rejected…"
              className="w-full border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            {reasonError && <p className="text-xs text-red-600">{reasonError}</p>}
            <p className="text-xs text-muted-foreground/70">The uploader will see this reason.</p>
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600">Failed to reject. Please try again.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setReason(''); setTouched(false); onClose(); }}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
