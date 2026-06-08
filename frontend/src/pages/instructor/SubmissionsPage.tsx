import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Eye, Lock, CheckCircle2, Circle } from 'lucide-react';
import { assignmentsApi } from '@/api/assignments';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ErrorState } from '@/components/states/ErrorState';

/* ── State helpers ───────────────────────────────────────────────────── */
const STATE_BADGE: Record<string, { label: string; className: string; icon: typeof Circle }> = {
  OPEN:   { label: 'Open',   className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: Circle        },
  LOCKED: { label: 'Locked', className: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: Lock          },
  CLOSED: { label: 'Closed', className: 'bg-slate-50 text-slate-600 border border-slate-200',       icon: CheckCircle2  },
};

function deriveState(task: { is_open: boolean; is_closed: boolean; upload_open_at: string }): string {
  if (task.is_closed) return 'CLOSED';
  if (task.is_open || new Date(task.upload_open_at) <= new Date()) return 'OPEN';
  return 'LOCKED';
}

/* ── Skeleton ────────────────────────────────────────────────────────── */
function SubmissionsSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1.5 bg-emerald-400" />
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="h-4 w-40 bg-slate-100 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <div className="h-4 w-48 bg-slate-100 rounded flex-shrink-0" />
            <div className="h-4 w-28 bg-slate-100 rounded" />
            <div className="h-4 w-36 bg-slate-100 rounded" />
            <div className="h-5 w-16 bg-slate-100 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function InstructorSubmissionsPage() {
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedState, setSelectedState] = useState('all');

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });
  const groups = groupsQuery.data?.data ?? [];

  const assignmentsQuery = useQuery({
    queryKey: ['assignments', { group_id: selectedGroup, state: selectedState }],
    queryFn: () =>
      assignmentsApi.list({
        group_id: selectedGroup !== 'all' ? selectedGroup : undefined,
        state:    selectedState !== 'all' ? selectedState : undefined,
      }),
  });
  const assignments = assignmentsQuery.data?.data ?? [];
  const isLoading = groupsQuery.isLoading || assignmentsQuery.isLoading;
  const isError   = groupsQuery.isError   || assignmentsQuery.isError;

  const handleRetry = () => {
    if (groupsQuery.isError)      void groupsQuery.refetch();
    if (assignmentsQuery.isError) void assignmentsQuery.refetch();
  };

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 flex-shrink-0">
          <ClipboardCheck className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Submissions Overview</h1>
          <p className="text-sm text-slate-500">Review participant submissions across your assigned groups.</p>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-52 bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="w-40 bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="LOCKED">Locked</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table card ───────────────────────────────────────────────── */}
      {isLoading ? (
        <SubmissionsSkeleton />
      ) : isError ? (
        <ErrorState title="Failed to load assignments" onRetry={handleRetry} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Emerald accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

          {/* Count header */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-medium text-slate-500">
              {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50">
                <ClipboardCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">No assignments found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedGroup !== 'all' || selectedState !== 'all'
                    ? 'Try adjusting your filters.'
                    : 'No assignments are available for your groups yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 bg-slate-50/40 hover:bg-slate-50/40">
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Title</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Group</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Deadline</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">State</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map(task => {
                    const state = deriveState(task);
                    const badge = STATE_BADGE[state] ?? STATE_BADGE.CLOSED;
                    const BadgeIcon = badge.icon;
                    return (
                      <TableRow key={task.id} className="border-slate-100 hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800 max-w-[220px] truncate" title={task.title}>
                          {task.title}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center text-xs font-medium text-[#0052A5] bg-blue-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                            {task.group_name || task.group_id}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                          {formatDate(task.deadline_at, 'dd MMM yyyy, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                            <BadgeIcon className="h-3 w-3" />
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                            <Link to={`/instructor/assignments/${task.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
