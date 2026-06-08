import { useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Download, FolderOpen, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { documentsApi } from '@/api/documents';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  classId: string;
  groupId: string;
}

const DOC_TYPE_OPTIONS = [
  { value: 'GUIDE',      label: 'Guide'      },
  { value: 'SLIDES',     label: 'Slides'     },
  { value: 'TEMPLATE',   label: 'Template'   },
  { value: 'REPORT',     label: 'Report'     },
  { value: 'REFERENCE',  label: 'Reference'  },
  { value: 'QUIZ',       label: 'Quiz'       },
  { value: 'SCHEDULE',   label: 'Schedule'   },
  { value: 'CASE_STUDY', label: 'Case Study' },
];

const DOC_TYPE_COLORS: Record<string, string> = {
  SLIDES:     'bg-blue-50 text-[#0052A5]',
  GUIDE:      'bg-violet-50 text-violet-700',
  REPORT:     'bg-rose-50 text-rose-700',
  TEMPLATE:   'bg-teal-50 text-teal-700',
  REFERENCE:  'bg-amber-50 text-amber-700',
  CASE_STUDY: 'bg-orange-50 text-orange-700',
  QUIZ:       'bg-emerald-50 text-emerald-700',
  SCHEDULE:   'bg-sky-50 text-sky-700',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClassDocumentUploadCard({ classId, groupId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Pending upload state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [docType, setDocType] = useState('GUIDE');
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch existing documents for this class
  const { data } = useQuery({
    queryKey: ['documents', { group_id: groupId }],
    queryFn: () => documentsApi.list({ group_id: groupId }),
    enabled: !!groupId,
  });
  const docs = (data?.data ?? []).filter(d => d.class_id === classId);

  const handleDownload = async (docId: string) => {
    try {
      const res = await apiClient.get<{ data: { download_url: string } }>(`/documents/${docId}/download`);
      window.open(res.data.data.download_url, '_blank');
    } catch {
      toast.error('Could not get download link.');
    }
  };

  const pickFile = (file: File) => {
    setPendingFile(file);
    setDescription('');
    setConfirmed(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, []);

  const handleUpload = async () => {
    if (!pendingFile || !confirmed) return;
    setUploading(true);
    try {
      // 1. Get presigned upload URL
      const urlRes = await documentsApi.getUploadUrl(pendingFile.name, pendingFile.type || 'application/octet-stream');
      const { upload_url, blob_name } = urlRes.data;

      // 2. PUT file directly to storage
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: pendingFile,
        headers: { 'Content-Type': pendingFile.type || 'application/octet-stream' },
      });
      if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.status}`);

      // 3. Create document record
      await documentsApi.create({
        group_id: groupId,
        class_id: classId,
        title: pendingFile.name.replace(/\.[^/.]+$/, ''),
        description,
        file_url: blob_name,
        file_name: pendingFile.name,
        file_type: pendingFile.type || 'application/octet-stream',
        file_size: pendingFile.size,
        doc_type: docType,
        visibility: 'PUBLIC_TO_CLASS',
      });

      void queryClient.invalidateQueries({ queryKey: ['documents', { group_id: groupId }] });
      toast.success('Document uploaded and published to participants.');
      setPendingFile(null);
      setDescription('');
      setConfirmed(false);
      setDocType('GUIDE');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 flex-shrink-0">
          <FolderOpen className="h-3.5 w-3.5 text-[#E31837]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 leading-tight">Class Documents</p>
          <p className="text-xs text-slate-400">Upload files visible to all participants</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Drag-and-drop zone */}
        {!pendingFile ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 px-4 text-center
              ${dragging
                ? 'border-violet-400 bg-violet-50'
                : 'border-slate-200 bg-slate-50/60 hover:border-violet-300 hover:bg-violet-50/40'
              }`}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100">
              <Upload className="h-5 w-5 text-violet-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">Drop a file here or click to browse</p>
            <p className="text-xs text-slate-400">PDF, DOCX, PPTX, XLSX, images — any format</p>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
            />
          </div>
        ) : (
          /* Upload form */
          <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            {/* Selected file */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-[#E31837]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{pendingFile.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(pendingFile.size)}</p>
              </div>
              <button
                onClick={() => setPendingFile(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Doc type */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Description <span className="text-slate-400">(optional)</span></Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe this document..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Confirmation */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-violet-600 h-4 w-4 flex-shrink-0"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                This document will be <span className="font-semibold text-violet-700">publicly visible</span> to all participants in this class session.
              </span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => void handleUpload()}
                disabled={uploading || !confirmed}
                className="bg-[#E31837] hover:bg-violet-700 text-white flex-1"
              >
                {uploading ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin mr-1.5" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload &amp; Publish
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingFile(null)}
                disabled={uploading}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing documents list */}
        {docs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-0.5">
              Uploaded ({docs.length})
            </p>
            {docs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-2.5 py-2 px-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white transition-colors"
              >
                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                  {doc.description && (
                    <p className="text-xs text-slate-400 truncate">{doc.description}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-slate-100 text-slate-600'}`}>
                  {doc.doc_type.replace('_', ' ')}
                </span>
                <button
                  onClick={() => void handleDownload(doc.id)}
                  className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-[#E31837] hover:bg-violet-50 transition-colors"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && !pendingFile && (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-slate-300 mb-1" />
            <p className="text-xs text-slate-400">No documents uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
