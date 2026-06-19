import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { UploadDocumentDialog } from '@/features/admin/documents/UploadDocumentDialog';
import { documentsApi } from '@/api/documents';
import { classesApi } from '@/api/classes';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';
import type { Document } from '@/lib/types';

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

function DeleteDocDialog({
  doc,
  onConfirm,
  onCancel,
  isPending,
}: {
  doc: Document;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Document?</DialogTitle>
          <DialogDescription>
            Delete <strong>{doc.title}</strong>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsTab({ groupId }: { groupId: string }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [subGroupFilter, setSubGroupFilter] = useState('__all__');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['documents', 'group', groupId],
    queryFn: () => documentsApi.list({ group_id: groupId }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', groupId],
    queryFn: () => groupsApi.listSubGroups(groupId),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes', { group_id: groupId }],
    queryFn: () => classesApi.list({ group_id: groupId }),
    enabled: subGroupFilter !== '__all__',
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await documentsApi.download(id);
      window.open(res.data.download_url, '_blank', 'noreferrer');
    } catch {
      toast.error('Failed to get download link.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents', 'group', groupId] });
      toast.success('Document deleted.');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete document.'),
  });

  const docs = data?.data ?? [];
  const subGroups = subGroupsData?.data ?? [];

  const filtered = useMemo(() => {
    if (subGroupFilter === '__all__') return docs;
    const subGroupClassIds = new Set(
      (classesData?.data ?? [])
        .filter(c => c.sub_group_id === subGroupFilter)
        .map(c => c.id),
    );
    return docs.filter(doc => doc.class_id && subGroupClassIds.has(doc.class_id));
  }, [docs, subGroupFilter, classesData]);

  const showSkeleton = isLoading || (isFetching && docs.length === 0);

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100 gap-3">
          <h3 className="font-semibold text-slate-800 shrink-0">Documents</h3>
          <div className="flex items-center gap-2 ml-auto">
            {subGroups.length > 0 && (
              <Select value={subGroupFilter} onValueChange={setSubGroupFilter}>
                <SelectTrigger className="h-8 w-44 text-sm">
                  <SelectValue placeholder="All sub-groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sub-groups</SelectItem>
                  {subGroups.map(sg => (
                    <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdmin && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />
                Upload Document
              </Button>
            )}
          </div>
        </div>

        {showSkeleton ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {subGroupFilter !== '__all__'
                ? 'No documents found for this sub-group.'
                : 'No documents uploaded for this group yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
            {filtered.map(doc => (
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
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Download"
                    disabled={downloadingId === doc.id}
                    onClick={() => handleDownload(doc.id)}
                  >
                    {downloadingId === doc.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />}
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Delete document"
                      onClick={() => setDeleteTarget(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

      {deleteTarget && (
        <DeleteDocDialog
          doc={deleteTarget}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </>
  );
}
