import { useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Download, FolderOpen, X, CheckCircle2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { documentsApi } from '@/api/documents';
import { validateFile } from '@/lib/fileValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  classId: string;
  groupId: string;
}

const DOC_TYPE_COLORS: Record<string, string> = {
  SLIDES:     'bg-blue-50 text-[#0052A5]',
  GUIDE:      'bg-violet-50 text-violet-700',
  REPORT:     'bg-rose-50 text-rose-700',
  TEMPLATE:   'bg-teal-50 text-teal-700',
  REFERENCE:  'bg-amber-50 text-amber-700',
  CASE_STUDY: 'bg-orange-50 text-orange-700',
  QUIZ:       'bg-emerald-50 text-emerald-700',
  SCHEDULE:   'bg-sky-50 text-sky-700',
  MOM:        'bg-indigo-50 text-indigo-700',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  GUIDE: 'Guide', SLIDES: 'Slides', TEMPLATE: 'Template',
  REPORT: 'Report', REFERENCE: 'Reference', QUIZ: 'Quiz',
  SCHEDULE: 'Schedule', CASE_STUDY: 'Case Study', MOM: 'MOM',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Step = 'idle' | 'pick-type' | 'form';
type TypeChoice = 'NORMAL' | 'MOM' | 'CUSTOM';

export function ClassDocumentUploadCard({ classId, groupId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [step, setStep] = useState<Step>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [typeChoice, setTypeChoice] = useState<TypeChoice>('NORMAL');
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [docType, setDocType] = useState('GUIDE');
  const [description, setDescription] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const reset = () => {
    setPendingFile(null);
    setStep('idle');
    setTypeChoice('NORMAL');
    setCustomTypeInput('');
    setDocType('GUIDE');
    setDescription('');
    setConfirmed(false);
  };

  const pickFile = (file: File) => {
    setPendingFile(file);
    setTypeChoice('NORMAL');
    setCustomTypeInput('');
    setConfirmed(false);
    setStep('pick-type');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, []);

  const confirmType = () => {
    if (typeChoice === 'NORMAL') setDocType('GUIDE');
    else if (typeChoice === 'MOM') setDocType('MOM');
    else setDocType(customTypeInput.trim().toUpperCase().replace(/\s+/g, '_') || 'CUSTOM');
    setStep('form');
  };

  const handleUpload = async () => {
    if (!pendingFile || !confirmed) return;
    const validation = validateFile(pendingFile);
    if (!validation.ok) { toast.error(validation.error); return; }
    setUploading(true);
    try {
      const urlRes = await documentsApi.getUploadUrl(pendingFile.name, pendingFile.type || 'application/octet-stream');
      const { upload_url, blob_name } = urlRes.data;

      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: pendingFile,
        headers: { 'Content-Type': pendingFile.type || 'application/octet-stream' },
      });
      if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.status}`);

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
      const typeLabel = typeChoice === 'MOM' ? 'MOM' : typeChoice === 'CUSTOM' ? (customTypeInput.trim() || 'Custom') : 'Normal Doc';
      toast.success(`${typeLabel} uploaded and published to participants.`);
      reset();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resolvedLabel =
    typeChoice === 'MOM' ? 'MOM'
    : typeChoice === 'CUSTOM' ? (customTypeInput.trim() || 'Custom')
    : 'Normal Doc';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />

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

        {/* ── Step: idle — drag-drop zone ── */}
        {step === 'idle' && (
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
        )}

        {/* ── Step: pick-type ── */}
        {step === 'pick-type' && pendingFile && (
          <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            {/* File name row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-[#E31837]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{pendingFile.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(pendingFile.size)}</p>
              </div>
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Remove file">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type prompt */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">What type is this document?</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Normal */}
                <button
                  type="button"
                  onClick={() => setTypeChoice('NORMAL')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all text-center
                    ${typeChoice === 'NORMAL'
                      ? 'border-violet-500 bg-violet-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-violet-300'}`}
                >
                  <span className="text-lg">📄</span>
                  <span className="text-xs font-semibold text-slate-700 leading-tight">Normal Doc</span>
                </button>
                {/* MOM */}
                <button
                  type="button"
                  onClick={() => setTypeChoice('MOM')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all text-center
                    ${typeChoice === 'MOM'
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                >
                  <span className="text-lg">📋</span>
                  <span className="text-xs font-semibold text-slate-700 leading-tight">MOM</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Minutes of Meeting</span>
                </button>
                {/* Custom */}
                <button
                  type="button"
                  onClick={() => setTypeChoice('CUSTOM')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all text-center
                    ${typeChoice === 'CUSTOM'
                      ? 'border-amber-500 bg-amber-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-amber-300'}`}
                >
                  <span className="text-lg">✏️</span>
                  <span className="text-xs font-semibold text-slate-700 leading-tight">Custom…</span>
                </button>
              </div>

              {typeChoice === 'CUSTOM' && (
                <Input
                  className="mt-2 text-sm"
                  placeholder="e.g. Feedback, Case Study, Action Items…"
                  value={customTypeInput}
                  onChange={e => setCustomTypeInput(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={confirmType}
                disabled={typeChoice === 'CUSTOM' && !customTypeInput.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white flex-1"
              >
                Continue
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
              <Button size="sm" variant="outline" onClick={reset} className="border-slate-200 text-slate-600">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: form ── */}
        {step === 'form' && pendingFile && (
          <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            {/* File + chosen type */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-[#E31837]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{pendingFile.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(pendingFile.size)}</p>
              </div>
              <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border
                ${typeChoice === 'MOM' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : typeChoice === 'CUSTOM' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'}`}
              >
                {resolvedLabel}
              </span>
              <button onClick={() => setStep('pick-type')} className="text-slate-400 hover:text-violet-600 transition-colors text-xs underline ml-1 shrink-0">
                Change
              </button>
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 transition-colors ml-0.5" aria-label="Remove file">
                <X className="h-4 w-4" />
              </button>
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
                This <span className="font-semibold text-violet-700">{resolvedLabel}</span> will be
                publicly visible to all participants in this class session.
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
                onClick={reset}
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
                  {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type.replace(/_/g, ' ')}
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

        {docs.length === 0 && step === 'idle' && (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-slate-300 mb-1" />
            <p className="text-xs text-slate-400">No documents uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
