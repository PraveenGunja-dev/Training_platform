import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadDocumentDialog } from '@/features/admin/documents/UploadDocumentDialog';
import { documentsApi } from '@/api/documents';
import { formatDate } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';
const DOC_TYPE_LABEL: Record<string, string> = {
  SLIDES: 'Slides',
  TEMPLATE: 'Template',
  QUIZ: 'Quiz',
  REPORT: 'Report',
  GUIDE: 'Guide',
  SUMMARY: 'Summary',
  NOTES: 'Notes',
  REFERENCE: 'Reference',
  FEEDBACK: 'Feedback',
  SHARED: 'Shared',
  CASE_STUDY: 'Case Study',
  SCHEDULE: 'Schedule',
};

export function DocumentsTab({ groupId }: { groupId: string }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['documents', 'group', groupId],
    queryFn: () => documentsApi.list({ group_id: groupId }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const docs = data?.data ?? [];
  const showSkeleton = isLoading || (isFetching && docs.length === 0);

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Documents</h3>
          {isAdmin && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Upload Document
            </Button>
          )}
        </div>

        {showSkeleton ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents uploaded for this group yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
            {docs.map(doc => (
              <div
                key={doc.id}
                className="border rounded-lg p-4 flex items-start gap-3 hover:shadow-sm transition-shadow"
              >
                <div className="p-2 bg-[#EBF3FB] rounded text-[#0052A5] shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground/70">
                      {formatDate(doc.created_at, 'dd MMM yyyy')}
                    </span>
                  </div>
                </div>
                <a href={doc.file_url} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" aria-label="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <UploadDocumentDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultGroupId={groupId}
      />
    </>
  );
}
