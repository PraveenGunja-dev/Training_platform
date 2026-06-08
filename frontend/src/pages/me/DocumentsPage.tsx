import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Upload, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { documentsApi } from '@/api/documents';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { DocumentFilters } from '@/features/participant/documents/DocumentFilters';
import { DocumentList } from '@/features/participant/documents/DocumentList';
import { ShareDocumentDialog } from '@/features/participant/documents/ShareDocumentDialog';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import type { SharedDocStatus } from '@/lib/types';

const STATUS_CONFIG: Record<SharedDocStatus, { label: string; icon: typeof Clock; className: string }> = {
  PENDING:  { label: 'Pending Review', icon: Clock,         className: 'bg-amber-50 text-amber-700 border border-amber-200'   },
  APPROVED: { label: 'Approved',       icon: CheckCircle2,  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  REJECTED: { label: 'Rejected',       icon: XCircle,       className: 'bg-rose-50 text-rose-700 border border-rose-200'       },
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [selectedGroup,   setSelectedGroup]   = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [search, setSearch] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const { data: docsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn:  () => documentsApi.list(),
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn:  () => groupsApi.list(),
  });

  const { data: permsData } = useQuery({
    queryKey: ['upload-permissions'],
    queryFn:  () => documentsApi.uploadPermissions(),
  });

  const { data: myUploadsData } = useQuery({
    queryKey: ['my-shared-uploads'],
    queryFn:  () => documentsApi.mySharedUploads(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const allDocs      = useMemo(() => docsData?.data   ?? [], [docsData]);
  const allGroups    = useMemo(() => groupsData?.data  ?? [], [groupsData]);
  const permissions  = useMemo(() => permsData?.data   ?? [], [permsData]);
  const myUploads    = useMemo(() => myUploadsData?.data ?? [], [myUploadsData]);

  // Groups where this participant has upload permission
  const permittedGroupIds = useMemo(() => new Set(permissions.map(p => p.group_id)), [permissions]);
  const permittedGroups   = useMemo(() => allGroups.filter(g => permittedGroupIds.has(g.id)), [allGroups, permittedGroupIds]);
  const canUpload         = permittedGroups.length > 0;

  const docGroupIds = useMemo(
    () => [...new Set(allDocs.map(d => d.group_id))],
    [allDocs],
  );
  const visibleGroups = useMemo(
    () => allGroups.filter(g => docGroupIds.includes(g.id)),
    [allGroups, docGroupIds],
  );

  const docTypes = useMemo(
    () => [...new Set(allDocs.map(d => d.doc_type))].sort(),
    [allDocs],
  );

  const groupMap = useMemo(
    () => new Map(allGroups.map(g => [g.id, g.name])),
    [allGroups],
  );

  const filtered = useMemo(() => {
    let items = [...allDocs];
    if (selectedGroup)   items = items.filter(d => d.group_id === selectedGroup);
    if (selectedDocType) items = items.filter(d => d.doc_type === selectedDocType);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(d => d.title.toLowerCase().includes(q));
    }
    return items;
  }, [allDocs, selectedGroup, selectedDocType, search]);

  const isFiltered = selectedGroup !== '' || selectedDocType !== '' || search.trim() !== '';

  function handleReset() {
    setSelectedGroup('');
    setSelectedDocType('');
    setSearch('');
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 flex-shrink-0">
            <FileText className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Documents</h1>
            <p className="text-sm text-slate-500">Resources and files shared with your groups.</p>
          </div>
        </div>
        {canUpload && (
          <Button
            onClick={() => setShareOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex-shrink-0"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Share Document
          </Button>
        )}
      </div>

      {/* My Uploads section — only shown if participant has submitted at least one */}
      {myUploads.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-400 to-cyan-400" />
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-semibold text-slate-700">My Submitted Documents</p>
            <p className="text-xs text-slate-400 mt-0.5">Status of files you shared for admin review.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {myUploads.map(doc => {
              const cfg = STATUS_CONFIG[doc.status];
              const Icon = cfg.icon;
              return (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 flex-shrink-0">
                    <FileText className="h-4 w-4 text-teal-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-400">
                      {groupMap.get(doc.group_id) ?? 'Group'} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at, 'dd MMM yyyy')}
                    </p>
                    {doc.status === 'REJECTED' && doc.rejection_reason && (
                      <p className="text-xs text-rose-600 mt-0.5">Reason: {doc.rejection_reason}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${cfg.className}`}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <div className="w-52 shrink-0">
          <DocumentFilters
            groups={visibleGroups}
            docTypes={docTypes}
            selectedGroup={selectedGroup}
            selectedDocType={selectedDocType}
            onGroupChange={setSelectedGroup}
            onDocTypeChange={setSelectedDocType}
            onReset={handleReset}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>

          <p className="text-xs text-slate-400" aria-live="polite">
            {isLoading ? 'Loading…' : `${filtered.length} document${filtered.length !== 1 ? 's' : ''}`}
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-48 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState title="Failed to load documents" onRetry={() => void refetch()} />
          ) : (
            <DocumentList
              documents={filtered}
              groupMap={groupMap}
              isFiltered={isFiltered}
              onReset={handleReset}
            />
          )}
        </div>
      </div>

      <ShareDocumentDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        permittedGroups={permittedGroups}
      />
    </div>
  );
}
