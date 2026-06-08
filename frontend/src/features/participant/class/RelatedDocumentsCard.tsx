import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { documentsApi } from '@/api/documents';

interface Props {
  classId: string;
  groupId: string;
}

const DOC_TYPE_COLORS: Record<string, string> = {
  SLIDES:     'bg-blue-50 text-[#0052A5]',
  GUIDE:      'bg-violet-50 text-violet-700',
  REPORT:     'bg-rose-50   text-rose-700',
  TEMPLATE:   'bg-teal-50   text-teal-700',
  REFERENCE:  'bg-amber-50  text-amber-700',
  CASE_STUDY: 'bg-orange-50 text-orange-700',
  QUIZ:       'bg-emerald-50 text-emerald-700',
  SCHEDULE:   'bg-sky-50    text-sky-700',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  SLIDES: 'Slides', TEMPLATE: 'Template', QUIZ: 'Quiz', GUIDE: 'Guide',
  REFERENCE: 'Reference', CASE_STUDY: 'Case Study', SCHEDULE: 'Schedule',
  REPORT: 'Report', SHARED: 'Shared',
};

function DocItem({ doc }: { doc: { id: string; title: string; description: string; doc_type: string } }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: { download_url: string } }>(`/documents/${doc.id}/download`);
      window.open(res.data.data.download_url, '_blank');
    } catch {
      toast.error('Could not get download link.');
    } finally {
      setLoading(false);
    }
  };

  const chipCls = DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-slate-50 text-slate-600';

  return (
    <div className="group rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-violet-200 hover:shadow-sm transition-all p-3">
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 flex-shrink-0 mt-0.5">
          <FileText className="h-3.5 w-3.5 text-[#E31837]" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{doc.title}</p>
          {doc.description && (
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{doc.description}</p>
          )}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chipCls}`}>
              {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
            </span>
            <button
              onClick={() => void handleDownload()}
              disabled={loading}
              className="flex items-center gap-1 text-xs font-medium text-[#E31837] hover:text-violet-800 transition-colors disabled:opacity-60"
              title="Download"
            >
              {loading
                ? <span className="h-3 w-3 rounded-full border border-violet-300 border-t-violet-600 animate-spin" />
                : <Download className="h-3 w-3" />
              }
              {loading ? 'Loading…' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RelatedDocumentsCard({ classId, groupId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['documents', { group_id: groupId }],
    queryFn: () => documentsApi.list({ group_id: groupId }),
    enabled: !!groupId,
  });

  const docs = (data?.data ?? []).filter(d => d.class_id === classId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 flex-shrink-0">
          <FolderOpen className="h-3.5 w-3.5 text-[#E31837]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 leading-tight">Class Documents</p>
          {!isLoading && docs.length > 0 && (
            <p className="text-xs text-slate-400">{docs.length} file{docs.length !== 1 ? 's' : ''} available</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
          </div>
        )}

        {!isLoading && docs.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-50 mb-2">
              <FolderOpen className="h-5 w-5 text-violet-300" />
            </div>
            <p className="text-xs text-slate-400 font-medium">No documents for this class yet.</p>
          </div>
        )}

        {docs.map(doc => (
          <DocItem key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}
