import { useState } from 'react';
import { Download, FileText, Calendar, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi } from '@/api/documents';
import { formatDate } from '@/lib/dates';
import { formatBytes } from '@/lib/fileValidation';
import type { Document } from '@/lib/types';

const DOC_TYPE_LABELS: Record<string, string> = {
  SLIDES: 'Slides', TEMPLATE: 'Template', QUIZ: 'Quiz', GUIDE: 'Guide',
  REFERENCE: 'Reference', CASE_STUDY: 'Case Study', SCHEDULE: 'Schedule',
  REPORT: 'Report', SHARED: 'Shared', OTHER: 'Other',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  SLIDES:     'bg-blue-50 text-[#0052A5] border-blue-200',
  GUIDE:      'bg-violet-50 text-violet-700 border-violet-200',
  REPORT:     'bg-rose-50   text-rose-700   border-rose-200',
  TEMPLATE:   'bg-teal-50   text-teal-700   border-teal-200',
  REFERENCE:  'bg-amber-50  text-amber-700  border-amber-200',
  CASE_STUDY: 'bg-orange-50 text-orange-700 border-orange-200',
  QUIZ:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  SCHEDULE:   'bg-sky-50    text-sky-700    border-sky-200',
  SHARED:     'bg-slate-50  text-slate-600  border-slate-200',
};

interface DocumentCardProps {
  doc: Document;
  groupName?: string;
}

export function DocumentCard({ doc, groupName }: DocumentCardProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await documentsApi.download(doc.id, doc.file_name);
    } catch {
      toast.error('Could not download file. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const chipCls = DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Icon + title row */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 flex-shrink-0 mt-0.5">
            <FileText className="h-4 w-4 text-[#E31837]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
              {doc.title}
            </p>
            {groupName && (
              <span className="inline-flex items-center mt-1 text-xs font-medium text-[#0052A5] bg-blue-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                {groupName}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {doc.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            {doc.description}
          </p>
        )}

        {/* Doc type chip */}
        <div>
          <span className={`inline-flex items-center text-xs font-semibold border px-2.5 py-0.5 rounded-full ${chipCls}`}>
            {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
          </span>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-auto pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {formatBytes(doc.file_size)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(doc.created_at, 'dd MMM yyyy')}
          </span>
        </div>

        {/* Download button */}
        <button
          onClick={() => void handleDownload()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 hover:border-violet-300 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {loading ? 'Downloading…' : 'Download'}
        </button>
      </div>
    </div>
  );
}
