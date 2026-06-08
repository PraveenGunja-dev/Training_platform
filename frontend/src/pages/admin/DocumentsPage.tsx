import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Edit2, Download } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { documentsApi } from '@/api/documents';
import { groupsApi } from '@/api/groups';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UploadDocumentDialog } from '@/features/admin/documents/UploadDocumentDialog';
import { ErrorState } from '@/components/states/ErrorState';
import { formatDate } from '@/lib/dates';
import type { DocVisibility } from '@/lib/types';

/* ── Badge maps ──────────────────────────────────────────────────────── */
const VISIBILITY_BADGE: Record<DocVisibility, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' }> = {
  GROUP:          { label: 'Group',          variant: 'success'   },
  SELECTED:       { label: 'Selected',       variant: 'warning'   },
  STAFF_ONLY:     { label: 'Staff Only',     variant: 'secondary' },
  PUBLIC_TO_CLASS:{ label: 'Public to Class',variant: 'info'      },
};

const DOC_TYPE_CHIP: Record<string, string> = {
  SLIDES:     'bg-blue-50 text-[#0052A5] border border-indigo-100',
  GUIDE:      'bg-violet-50 text-violet-700 border border-violet-100',
  REPORT:     'bg-rose-50 text-rose-700 border border-rose-100',
  TEMPLATE:   'bg-teal-50 text-teal-700 border border-teal-100',
  REFERENCE:  'bg-amber-50 text-amber-700 border border-amber-100',
  CASE_STUDY: 'bg-orange-50 text-orange-700 border border-orange-100',
  QUIZ:       'bg-emerald-50 text-emerald-700 border border-emerald-100',
  SCHEDULE:   'bg-sky-50 text-sky-700 border border-sky-100',
};

/* ── Helpers ─────────────────────────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Stat pill ───────────────────────────────────────────────────────── */
function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${color}`}>
      <span className="tabular-nums text-sm font-bold">{count}</span>
      <span>{label}</span>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function AdminDocumentsPage() {
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [typeFilter, setTypeFilter]   = useState('ALL');
  const [showUpload, setShowUpload]   = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn:  () => groupsApi.list(),
    staleTime: 120_000,
  });
  const groupMap = new Map((groupsQuery.data?.data ?? []).map(g => [g.id, g.name]));
  const allGroups = groupsQuery.data?.data ?? [];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn:  () => documentsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const allDocs  = data?.data ?? [];
  const docTypes = [...new Set(allDocs.map(d => d.doc_type))];

  const filtered = allDocs.filter(d => {
    if (groupFilter !== 'ALL' && d.group_id !== groupFilter) return false;
    if (typeFilter  !== 'ALL' && d.doc_type !== typeFilter)  return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Visibility counts for stats
  const groupVisible  = allDocs.filter(d => d.visibility === 'GROUP').length;
  const staffOnly     = allDocs.filter(d => d.visibility === 'STAFF_ONLY').length;
  const publicClass   = allDocs.filter(d => d.visibility === 'PUBLIC_TO_CLASS').length;

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 flex-shrink-0">
            <FileText className="h-5 w-5 text-[#E31837]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Documents</h1>
            <p className="text-sm text-slate-500">All documents across all groups.</p>
          </div>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Upload Document
        </Button>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Total"          count={allDocs.length} color="bg-slate-50 text-slate-600 border-slate-200"           />
          <StatPill label="Group"          count={groupVisible}   color="bg-emerald-50 text-emerald-700 border-emerald-200"     />
          <StatPill label="Staff Only"     count={staffOnly}      color="bg-slate-50 text-slate-500 border-slate-200"           />
          <StatPill label="Public"         count={publicClass}    color="bg-sky-50 text-sky-700 border-sky-200"                 />
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title…"
          className="w-56"
        />
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-48 bg-white border-slate-200">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Groups</SelectItem>
            {allGroups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-white border-slate-200">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {docTypes.map(t => (
              <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Violet accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500" />

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-500">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true" aria-label="Loading documents…">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load documents" onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No documents found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 bg-slate-50/40 hover:bg-slate-50/40">
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Title</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Type</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Group</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Visibility</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Size</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Uploaded</TableHead>
                  <TableHead className="text-right text-slate-400 font-medium text-xs uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => {
                  const vb = VISIBILITY_BADGE[doc.visibility];
                  const typeChip = DOC_TYPE_CHIP[doc.doc_type] ?? 'bg-slate-50 text-slate-600 border border-slate-200';
                  const groupName = groupMap.get(doc.group_id) ?? doc.group_id;
                  const docTypeLabel = doc.doc_type.charAt(0) + doc.doc_type.slice(1).toLowerCase().replace('_', ' ');
                  return (
                    <TableRow key={doc.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell
                        className="font-semibold text-slate-800 text-sm max-w-[200px] truncate"
                        title={doc.title}
                      >
                        {doc.title}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeChip}`}>
                          {docTypeLabel}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-xs font-medium text-[#0052A5] bg-blue-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                          {groupName}
                        </span>
                      </TableCell>
                      <TableCell>
                        {vb && <Badge variant={vb.variant}>{vb.label}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {formatBytes(doc.file_size)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(doc.created_at, 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Download"
                            onClick={async () => {
                              try {
                                const res = await apiClient.get<{ data: { download_url: string } }>(`/documents/${doc.id}/download`);
                                window.open(res.data.data.download_url, '_blank');
                              } catch {
                                toast.error('Could not get download link.');
                              }
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Edit visibility" disabled>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm('Delete this document?')) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <UploadDocumentDialog open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
}
