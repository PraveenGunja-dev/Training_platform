import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Download } from 'lucide-react';
import { auditApi } from '@/api/audit';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AuditTable } from '@/features/admin/audit/AuditTable';
import { AuditFilters, type AuditFilterValues } from '@/features/admin/audit/AuditFilters';
import { ErrorState } from '@/components/states/ErrorState';
import type { AuditEntry } from '@/lib/types';

const LIMIT = 20;

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilterValues>({
    actorId: '', action: '', targetType: '', from: '', to: '',
  });
  // Extra pages appended via "Load more" — cleared on filter change
  const [extraEntries, setExtraEntries] = useState<AuditEntry[]>([]);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreGenRef = useRef(0);

  // Reset load-more state whenever filters change so stale extra pages
  // never bleed into a new filter's result set.
  useEffect(() => {
    loadMoreGenRef.current += 1;
    setExtraEntries([]);
    setCursor(null);
    setHasMore(false);
  }, [filters]);

  // Primary query — data lives in React Query cache, not local state
  const { data, isFetching, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', filters],
    queryFn:  async () => auditApi.list({
      actor_id:    filters.actorId    || undefined,
      action:      filters.action     || undefined,
      target_type: filters.targetType || undefined,
      from: filters.from ? `${filters.from}T00:00:00Z` : undefined,
      to:   filters.to   ? `${filters.to}T23:59:59.999999Z`   : undefined,
      limit: LIMIT,
    }),
  });

  // Sync cursor/hasMore from query data on fresh loads (not while load-more is active)
  useEffect(() => {
    if (extraEntries.length > 0) return;
    const meta = data?.meta as { next_cursor?: string | null } | undefined;
    setCursor(meta?.next_cursor ?? null);
    setHasMore(!!meta?.next_cursor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // First-page entries come from cache; extra pages are appended locally
  const firstPage = data?.data ?? [];
  const entries = [...firstPage, ...extraEntries];

  const loadMore = useCallback(async () => {
    if (!cursor || isFetching) return;
    const gen = loadMoreGenRef.current;
    const res = await auditApi.list({
      actor_id:    filters.actorId    || undefined,
      action:      filters.action     || undefined,
      target_type: filters.targetType || undefined,
      from: filters.from ? `${filters.from}T00:00:00Z` : undefined,
      to:   filters.to   ? `${filters.to}T23:59:59.999999Z`   : undefined,
      cursor,
      limit: LIMIT,
    });
    if (loadMoreGenRef.current !== gen) return;
    setExtraEntries(prev => [...prev, ...res.data]);
    const meta = res.meta as { next_cursor: string | null } | undefined;
    setCursor(meta?.next_cursor ?? null);
    setHasMore(!!meta?.next_cursor);
  }, [cursor, filters, isFetching]);

  const handleFiltersChange = (newFilters: AuditFilterValues) => {
    setFilters(newFilters);
    // Load-more state is reset by useEffect watching `filters`
  };

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await apiClient.get('/audit/export', {
        params: {
          actor_id:    filters.actorId    || undefined,
          action:      filters.action     || undefined,
          target_type: filters.targetType || undefined,
          from: filters.from ? `${filters.from}T00:00:00Z` : undefined,
          to:   filters.to   ? `${filters.to}T23:59:59.999999Z`   : undefined,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit_log.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setExportError(
        status === 403
          ? 'You do not have permission to export audit logs.'
          : 'Export failed. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0">
            <ScrollText className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Audit Log</h1>
            <p className="text-sm text-slate-500">A complete record of all actions performed by users across the platform.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={isExporting || isLoading}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          {exportError && (
            <p className="text-xs text-red-500">{exportError}</p>
          )}
        </div>
      </div>

      <AuditFilters filters={filters} onChange={handleFiltersChange} />

      {/* ── Log card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-slate-500 to-slate-700" />

        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-500">
            {isLoading ? 'Loading…' : hasMore ? `${entries.length} entries loaded` : `${entries.length} entries`}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse">
            {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load audit log" onRetry={() => void refetch()} />
        ) : (
          <AuditTable entries={entries} />
        )}

        {hasMore && (
          <div className="flex justify-center py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => void loadMore()} disabled={isFetching}>
              {isFetching ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
