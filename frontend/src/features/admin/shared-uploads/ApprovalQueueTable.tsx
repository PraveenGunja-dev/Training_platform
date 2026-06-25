import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/dates';
import { documentsApi } from '@/api/documents';
import { ApproveDialog } from './ApproveDialog';
import { RejectDialog } from './RejectDialog';
import { SubmissionPreviewDialog } from '../submissions/SubmissionPreviewDialog';
import type { ParticipantSharedDoc, SubmissionWithUser } from '@/lib/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(type: string): string {
  if (type === 'application/pdf') return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  return '📁';
}

function sharedToPreview(upload: ParticipantSharedDoc): SubmissionWithUser {
  return {
    id: upload.id,
    task_id: '',
    user_id: upload.uploaded_by_id,
    version: 1,
    file_url: upload.file_url,
    file_name: upload.file_name,
    file_type: upload.file_type,
    file_size: upload.file_size,
    status: 'SUBMITTED',
    submitted_at: upload.created_at,
    submitted_by: upload.uploaded_by_id,
    note: '',
    user: {
      id: upload.uploaded_by_id,
      full_name: upload.uploaded_by?.full_name ?? 'Participant',
      email: upload.uploaded_by?.email ?? '',
      photo_url: upload.uploaded_by?.photo_url ?? null,
    },
    review: null,
  };
}

interface Props {
  uploads: ParticipantSharedDoc[];
  groupNames: Record<string, string>;
}

export function ApprovalQueueTable({ uploads, groupNames }: Props) {
  const queryClient = useQueryClient();
  const [approveTarget, setApproveTarget] = useState<ParticipantSharedDoc | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ParticipantSharedDoc | null>(null);
  const [previewTarget, setPreviewTarget] = useState<SubmissionWithUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ParticipantSharedDoc | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.deleteSharedUpload(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shared-uploads-pending'] });
      toast.success('Upload deleted.');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete upload.'),
  });

  if (uploads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/70">
        <CheckCircle2 className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No pending uploads</p>
        <p className="text-xs mt-1">All shared uploads have been reviewed.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/40 hover:bg-slate-50/40">
              <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">File</TableHead>
              <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Uploaded By</TableHead>
              <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Group</TableHead>
              <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Size</TableHead>
              <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Uploaded At</TableHead>
              <TableHead className="text-right text-slate-400 font-medium text-xs uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploads.map(upload => (
              <TableRow key={upload.id} className="border-slate-100 hover:bg-slate-50/50">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{fileTypeIcon(upload.file_type)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-[180px]" title={upload.file_name}>
                        {upload.title || upload.file_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">{upload.file_name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium text-slate-700">
                    {upload.uploaded_by?.full_name ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400">{upload.uploaded_by?.email ?? ''}</div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg">
                    {groupNames[upload.group_id] ?? upload.group_id}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                  {formatBytes(upload.file_size)}
                </TableCell>
                <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                  {formatDate(upload.created_at, 'dd MMM yyyy, h:mm a')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setPreviewTarget(sharedToPreview(upload))}
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setApproveTarget(upload)}
                      title="Approve"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setRejectTarget(upload)}
                      title="Reject"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(upload)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ApproveDialog
        upload={approveTarget}
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
      />
      <RejectDialog
        upload={rejectTarget}
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
      />
      <SubmissionPreviewDialog
        submission={previewTarget}
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Shared Upload</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteTarget?.title || deleteTarget?.file_name}</strong>? This upload
              will be permanently removed and the participant will not be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
