import { Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SubmissionWithUser } from '@/lib/types';

interface Props {
  submission: SubmissionWithUser | null;
  open: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PreviewContent({ sub }: { sub: SubmissionWithUser }) {
  const type = sub.file_type;
  const url = sub.file_url;

  if (type === 'application/pdf') {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white/5 rounded border border-dashed border-border text-muted-foreground text-sm gap-2">
        <span className="text-3xl">📄</span>
        <p>PDF preview not available in mock mode.</p>
        <p className="text-xs text-muted-foreground/70">{url}</p>
      </div>
    );
  }

  if (type.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center bg-white/5 rounded border p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <span className="text-3xl">🖼️</span>
          <p>Image preview not available in mock mode.</p>
        </div>
      </div>
    );
  }

  if (type.startsWith('video/')) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-white/5 rounded border border-dashed border-border text-muted-foreground text-sm gap-2">
        <span className="text-3xl">🎬</span>
        <p>Video preview not available in mock mode.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-40 bg-white/5 rounded border border-dashed border-border text-muted-foreground text-sm gap-2">
      <span className="text-3xl">📁</span>
      <p>This file type cannot be previewed in the browser.</p>
      <p className="text-xs">Download to view.</p>
    </div>
  );
}

export function SubmissionPreviewDialog({ submission, open, onClose }: Props) {
  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Preview — {submission.file_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{submission.file_type}</span>
            <span>{formatBytes(submission.file_size)}</span>
          </div>

          <PreviewContent sub={submission} />

          <div className="flex justify-end">
            <Button size="sm" variant="outline" asChild>
              <a href={submission.file_url} download={submission.file_name}>
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
