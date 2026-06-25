import { useRef, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, X, Info } from 'lucide-react';
import { documentsApi } from '@/api/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ClassGroup } from '@/lib/types';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  permittedGroups: ClassGroup[];
}

export function ShareDocumentDialog({ open, onClose, permittedGroups }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState(permittedGroups[0]?.id ?? '');

  // permittedGroups arrives after the component mounts (async query). If the
  // initial state was '' because data wasn't ready yet, sync it once it loads.
  useEffect(() => {
    if (!groupId && permittedGroups.length > 0) {
      setGroupId(permittedGroups[0].id);
    }
  }, [permittedGroups, groupId]);
  const [visibility, setVisibility] = useState('GROUP');
  const [uploading, setUploading] = useState(false);

  const pickFile = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (uploading) return;
    setFile(null);
    setTitle('');
    setVisibility('GROUP');
    onClose();
  };

  const handleSubmit = async () => {
    if (!file || !title.trim() || !groupId) return;
    setUploading(true);
    try {
      // Single multipart upload — submit shared doc for admin review
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('suggested_visibility', visibility);
      fd.append('suggested_user_ids', JSON.stringify([]));

      await documentsApi.submitSharedUpload(groupId, fd);

      void queryClient.invalidateQueries({ queryKey: ['my-shared-uploads'] });
      toast.success('Document submitted for review. Admin will approve or reject it shortly.');
      handleClose();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = !!file && title.trim().length > 0 && !!groupId && !uploading;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share a Document</DialogTitle>
          <DialogDescription>
            Upload a file for admin review. Once approved it will be published to the group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Group selector */}
          {permittedGroups.length > 1 && (
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {permittedGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File picker */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 px-4 text-center
                ${dragging
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/40'
                }`}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100">
                <Upload className="h-5 w-5 text-teal-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">Drop a file here or click to browse</p>
              <p className="text-xs text-slate-400">PDF, images, documents — any format</p>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/40 px-4 py-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-teal-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="share-title">Title</Label>
            <Input
              id="share-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Safety Audit Report Q2"
            />
          </div>

          {/* Suggested visibility */}
          <div className="space-y-1.5">
            <Label>Suggested Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GROUP">Visible to my group</SelectItem>
                <SelectItem value="PUBLIC_TO_CLASS">Visible to class participants</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="h-3 w-3 flex-shrink-0" />
              Admin may change this before approving.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>Cancel</Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {uploading ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin mr-1.5" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Submit for Review
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
