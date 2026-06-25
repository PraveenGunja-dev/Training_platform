import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, FileText, X, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DocumentVisibilityPicker } from './DocumentVisibilityPicker';
import { DOC_TYPES, documentSchema, type DocumentFormValues } from './documentSchema';
import { documentsApi } from '@/api/documents';
import { validateFile } from '@/lib/fileValidation';
import { classesApi } from '@/api/classes';
import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, ClassGroup, GroupDetail, DocVisibility } from '@/lib/types';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultGroupId?: string;
}

export function UploadDocumentDialog({ open, onClose, defaultGroupId }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'saving'>('idle');
  const [customDocType, setCustomDocType] = useState('');

  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: { visibility: 'GROUP', allowed_user_ids: [] },
  });

  useEffect(() => {
    if (open && defaultGroupId) {
      setValue('group_id', defaultGroupId);
    }
  }, [open, defaultGroupId, setValue]);

  const selectedGroupId    = watch('group_id');
  const selectedVisibility = watch('visibility');
  const allowedUserIds     = watch('allowed_user_ids') ?? [];

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiClient.get<ApiEnvelope<ClassGroup[]>>('/groups').then(r => r.data),
  });

  const classesQuery = useQuery({
    queryKey: ['classes', { group_id: selectedGroupId }],
    queryFn: () => classesApi.list({ group_id: selectedGroupId }),
    enabled: !!selectedGroupId,
  });

  const groupDetailQuery = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => apiClient.get<ApiEnvelope<GroupDetail>>(`/groups/${selectedGroupId}`).then(r => r.data),
    enabled: !!selectedGroupId && selectedVisibility === 'SELECTED',
  });

  const participants = groupDetailQuery.data?.data?.participants ?? [];
  const groups  = groupsQuery.data?.data  ?? [];
  const classes = classesQuery.data?.data ?? [];

  const pickFile = useCallback((file: File) => {
    setPendingFile(file);
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setValue('title', nameWithoutExt);
  }, [setValue]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, [pickFile]);

  const handleClose = () => {
    reset();
    setPendingFile(null);
    setUploadProgress('idle');
    setCustomDocType('');
    onClose();
  };

  const selectedDocType = watch('doc_type');

  const onSubmit = async (vals: DocumentFormValues) => {
    if (!pendingFile) {
      toast.error('Please select a file to upload.');
      return;
    }
    if (vals.doc_type === '__custom__') {
      if (!customDocType.trim()) {
        toast.error('Please enter a custom document type name.');
        return;
      }
      vals = { ...vals, doc_type: customDocType.trim().toUpperCase() };
    }
    // Validate file type and size before consuming a presigned URL slot
    const validation = validateFile(pendingFile);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setUploading(true);
    try {
      setUploadProgress('saving');
      const fd = new FormData();
      fd.append('file', pendingFile);
      fd.append('group_id', vals.group_id);
      if (vals.class_id) fd.append('class_id', vals.class_id);
      fd.append('title', vals.title);
      fd.append('description', vals.description || '');
      fd.append('doc_type', vals.doc_type);
      fd.append('visibility', vals.visibility);
      const allowedIds = vals.visibility === 'SELECTED' ? (vals.allowed_user_ids ?? []) : [];
      fd.append('allowed_user_ids', JSON.stringify(allowedIds));

      await documentsApi.create(fd);

      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully.');
      handleClose();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress('idle');
    }
  };

  const progressLabel =
    uploadProgress === 'saving' ? 'Uploading document…' : '';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100">
              <FolderOpen className="h-4.5 w-4.5 text-[#E31837]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">Upload Document</DialogTitle>
              <DialogDescription className="text-sm text-slate-400">
                Upload a file and configure its visibility for participants.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-1">

          {/* ── File drop zone ──────────────────────────────────────── */}
          {!pendingFile ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-10 px-4 text-center ${
                dragging
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-slate-200 bg-slate-50/60 hover:border-violet-300 hover:bg-violet-50/40'
              }`}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100">
                <Upload className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Drop a file here or click to browse</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF, Word, PowerPoint, Excel, images — any format</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-violet-200 bg-violet-50/60">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 flex-shrink-0">
                <FileText className="h-5 w-5 text-[#E31837]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{pendingFile.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(pendingFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Group ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Group <span className="text-rose-500">*</span></Label>
              <Controller
                control={control}
                name="group_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={v => {
                    field.onChange(v);
                    setValue('class_id', undefined);
                    setValue('allowed_user_ids', []);
                  }}>
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="Select group…" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.group_id && <p className="text-xs text-rose-600">{errors.group_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700">Linked Class <span className="text-xs text-slate-400">(optional)</span></Label>
              <Controller
                control={control}
                name="class_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={v => field.onChange(v === '__none__' ? undefined : v)}
                    disabled={!selectedGroupId}
                  >
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="None (group-level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (group-level)</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* ── Title ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-slate-700">Title <span className="text-rose-500">*</span></Label>
            <Input
              {...register('title')}
              placeholder="e.g. Session 1 — Safety Slides"
              className="bg-white border-slate-200"
            />
            {errors.title && <p className="text-xs text-rose-600">{errors.title.message}</p>}
          </div>

          {/* ── Description ────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-slate-700">Description <span className="text-xs text-slate-400">(optional)</span></Label>
            <Textarea
              {...register('description')}
              placeholder="Briefly describe what this document covers…"
              rows={2}
              className="resize-none bg-white border-slate-200"
            />
          </div>

          {/* ── Doc type ───────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-slate-700">Document Type <span className="text-rose-500">*</span></Label>
            <Controller
              control={control}
              name="doc_type"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={v => { field.onChange(v); if (v !== '__custom__') setCustomDocType(''); }}>
                  <SelectTrigger className="bg-white border-slate-200">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {selectedDocType === '__custom__' && (
              <Input
                placeholder="Enter type name (e.g. MOM, Minutes, Circular…)"
                value={customDocType}
                onChange={e => setCustomDocType(e.target.value)}
                className="bg-white border-slate-200"
                autoFocus
              />
            )}
            {errors.doc_type && <p className="text-xs text-rose-600">{errors.doc_type.message}</p>}
          </div>

          {/* ── Visibility ─────────────────────────────────────────── */}
          <DocumentVisibilityPicker
            value={selectedVisibility as DocVisibility}
            onChange={v => {
              setValue('visibility', v);
              if (v !== 'SELECTED') setValue('allowed_user_ids', []);
            }}
            allowedUserIds={allowedUserIds}
            onAllowedUsersChange={ids => setValue('allowed_user_ids', ids)}
            participants={participants}
          />
          {errors.allowed_user_ids && (
            <p className="text-xs text-rose-600">{errors.allowed_user_ids.message}</p>
          )}

          {/* ── Upload progress ─────────────────────────────────────── */}
          {uploadProgress !== 'idle' && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-200">
              <span className="h-4 w-4 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin flex-shrink-0" />
              <p className="text-sm font-medium text-violet-700">{progressLabel}</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !pendingFile}
              className="min-w-[120px]"
            >
              {uploading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {progressLabel || 'Uploading…'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Document
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
