import { useQuery } from '@tanstack/react-query';
import { Upload, Clock, CheckCircle2 } from 'lucide-react';
import { documentsApi } from '@/api/documents';
import { groupsApi } from '@/api/groups';
import { ApprovalQueueTable } from '@/features/admin/shared-uploads/ApprovalQueueTable';
import { ErrorState } from '@/components/states/ErrorState';

export default function InstructorSharedUploadsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shared-uploads-pending'],
    queryFn:  () => documentsApi.pendingSharedUploads(),
  });

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn:  () => groupsApi.list(),
  });

  const uploads    = data?.data ?? [];
  const groups     = groupsQuery.data?.data ?? [];
  const groupNames = Object.fromEntries(groups.map(g => [g.id, g.name]));

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 flex-shrink-0">
          <Upload className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Shared Uploads</h1>
          <p className="text-sm text-slate-500">Participant documents awaiting review in your assigned groups.</p>
        </div>
      </div>

      {/* ── Pending card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Amber accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-slate-700">Pending Approval</span>
          {!isLoading && (
            <span className="ml-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">
              {uploads.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true" aria-label="Loading shared uploads...">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load shared uploads" onRetry={() => void refetch()} />
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">All caught up</h3>
            <p className="text-sm text-slate-400 mt-1">No shared uploads pending approval.</p>
          </div>
        ) : (
          <ApprovalQueueTable uploads={uploads} groupNames={groupNames} />
        )}
      </div>
    </div>
  );
}
