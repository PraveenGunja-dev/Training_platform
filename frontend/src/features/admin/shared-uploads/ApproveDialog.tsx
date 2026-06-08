import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { documentsApi } from '@/api/documents';
import type { ParticipantSharedDoc, DocVisibility } from '@/lib/types';
import { VISIBILITY_OPTIONS } from '../documents/documentSchema';

interface Props {
  upload: ParticipantSharedDoc | null;
  open: boolean;
  onClose: () => void;
}

export function ApproveDialog({ upload, open, onClose }: Props) {
  const qc = useQueryClient();
  const [visibility, setVisibility] = useState<DocVisibility>('GROUP');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      documentsApi.approveSharedUpload(upload!.id, { visibility }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-uploads-pending'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['my-shared-uploads'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      setNote('');
      setVisibility('GROUP');
      onClose();
    },
  });

  if (!upload) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Upload</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm space-y-1">
            <p className="font-semibold text-slate-800">{upload.title || upload.file_name}</p>
            <p className="text-slate-400 text-xs">{upload.file_name}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Set Visibility for Approved Document</Label>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.filter(o => o.value !== 'SELECTED').map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    visibility === opt.value
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-border hover:border-white/15'
                  }`}
                >
                  <input
                    type="radio"
                    name="approve-vis"
                    value={opt.value}
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value as DocVisibility)}
                    className="accent-emerald-600"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note to uploader"
              className="w-full border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600">Failed to approve. Please try again.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Approving…' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
