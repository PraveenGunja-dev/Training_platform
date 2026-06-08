import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ListChecks, Eye, Lock, CheckCircle2, Circle, BookOpen, Plus, Trash2, Send, X as XIcon } from 'lucide-react';
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
import { CreateAssignmentDialog } from '@/features/admin/assignments/CreateAssignmentDialog';
import { useCan } from '@/hooks/useCan';
import type { LatePolicy, ClassGroup } from '@/lib/types';

/* ── Chips & badges ──────────────────────────────────────────────────── */
const LATE_POLICY_CHIP: Record<LatePolicy, { label: string; className: string }> = {
  STRICT:       { label: 'Strict',       className: 'bg-rose-50 text-rose-700 border border-rose-200'       },
  LATE_ALLOWED: { label: 'Late Allowed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  ADMIN_ONLY:   { label: 'Admin Only',   className: 'bg-amber-50 text-amber-700 border border-amber-200'     },
};

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

/* ── Stat pill ───────────────────────────────────────────────────────── */
function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${color}`}>
      <span className="tabular-nums text-sm font-bold">{count}</span>
      <span>{label}</span>
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────── */
function AssignmentsSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1.5 bg-amber-400" />
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="h-4 w-40 bg-slate-100 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {[...Array(6)].map((_, i) => (
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

/* ── Assignment row (own component so hooks are called at top-level) ─── */
interface AssignmentTask {
  id: string;
  title: string;
  group_id: string;
  group_name?: string;
  class_title?: string | null;
  deadline_at: string;
  late_policy: LatePolicy;
  is_open: boolean;
  is_closed: boolean;
  upload_open_at: string;
}

interface AssignmentRowProps {
  task: AssignmentTask;
  onPublish: (id: string) => void;
  onClose:   (id: string) => void;
  onDelete:  (id: string) => void;
  publishPending: boolean;
  closePending:   boolean;
  deletePending:  boolean;
}

function AssignmentRow({
  task, onPublish, onClose, onDelete,
  publishPending, closePending, deletePending,
}: AssignmentRowProps) {
  const state      = deriveState(task);
  const badge      = STATE_BADGE[state] ?? STATE_BADGE.CLOSED;
  const policyChip = LATE_POLICY_CHIP[task.late_policy];
  const BadgeIcon  = badge.icon;

  const canPublish = useCan('publish', 'assignment', { group_id: task.group_id });
  const canClose   = useCan('edit',    'assignment', { group_id: task.group_id });
  const canDelete  = useCan('delete',  'assignment', { group_id: task.group_id });

  return (
    <TableRow className="border-slate-100 hover:bg-slate-50/50">
      <TableCell className="font-semibold text-slate-800 max-w-[220px] truncate" title={task.title}>
        {task.title}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center text-xs font-medium text-[#0052A5] bg-blue-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
          {task.group_name || task.group_id}
        </span>
      </TableCell>
      <TableCell>
        {task.class_title ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-lg max-w-[160px] truncate" title={task.class_title}>
            <BookOpen className="h-3 w-3 flex-shrink-0" />
            {task.class_title}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-slate-700 whitespace-nowrap">
        {formatDate(task.deadline_at, 'dd MMM yyyy, h:mm a')}
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${policyChip.className}`}>
          {policyChip.label}
        </span>
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
          <BadgeIcon className="h-3 w-3" />
          {badge.label}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          {state === 'LOCKED' && canPublish && (
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
              onClick={() => onPublish(task.id)}
              disabled={publishPending}
            >
              <Send className="h-3.5 w-3.5" />
              Publish
            </Button>
          )}
          {state === 'OPEN' && canClose && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-slate-700 hover:bg-slate-100 gap-1"
              onClick={() => onClose(task.id)}
              disabled={closePending}
            >
              <XIcon className="h-3.5 w-3.5" />
              Close
            </Button>
          )}
          {state === 'LOCKED' && canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
              onClick={() => onDelete(task.id)}
              disabled={deletePending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild className="text-[#0052A5] hover:text-[#0052A5] hover:bg-blue-50">
            <Link to={`/instructor/assignments/${task.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function InstructorAssignmentsPage() {
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const queryClient = useQueryClient();
  const canCreate = useCan('create', 'assignment');

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });
  const groups: ClassGroup[] = groupsQuery.data?.data ?? [];

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

  const openCount   = assignments.filter(t => deriveState(t) === 'OPEN').length;
  const lockedCount = assignments.filter(t => deriveState(t) === 'LOCKED').length;
  const closedCount = assignments.filter(t => deriveState(t) === 'CLOSED').length;

  const handleRetry = () => {
    if (groupsQuery.isError)     void groupsQuery.refetch();
    if (assignmentsQuery.isError) void assignmentsQuery.refetch();
  };

  const publishMutation = useMutation({
    mutationFn: (taskId: string) => assignmentsApi.update(taskId, { is_open: true } as never),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment published.');
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error('You can only edit resources in groups you are assigned to.');
      } else {
        toast.error('Failed to publish assignment.');
      }
    },
  });

  const closeMutation = useMutation({
    mutationFn: (taskId: string) => assignmentsApi.close(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment closed.');
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error('You can only edit resources in groups you are assigned to.');
      } else {
        toast.error('Failed to close assignment.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => assignmentsApi.delete(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment deleted.');
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error('You can only edit resources in groups you are assigned to.');
      } else {
        toast.error('Failed to delete assignment.');
      }
    },
  });

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 flex-shrink-0">
            <ListChecks className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Assignments</h1>
            <p className="text-sm text-slate-500">All assignment tasks across your assigned groups.</p>
          </div>
        </div>
        {canCreate && (
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        )}
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Open"   count={openCount}   color="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <StatPill label="Locked" count={lockedCount} color="bg-amber-50 text-amber-700 border-amber-200"       />
          <StatPill label="Closed" count={closedCount} color="bg-slate-50 text-slate-600 border-slate-200"       />
          <span className="ml-auto text-sm text-slate-400 self-center">{assignments.length} total</span>
        </div>
      )}

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
        <AssignmentsSkeleton />
      ) : isError ? (
        <ErrorState title="Failed to load assignments" onRetry={handleRetry} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Amber accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />

          {/* Count header */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-medium text-slate-500">
              {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50">
                <ListChecks className="h-6 w-6 text-amber-400" />
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
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Class</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Deadline</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Late Policy</TableHead>
                    <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">State</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map(task => (
                    <AssignmentRow
                      key={task.id}
                      task={task}
                      onPublish={id => publishMutation.mutate(id)}
                      onClose={id => closeMutation.mutate(id)}
                      onDelete={id => deleteMutation.mutate(id)}
                      publishPending={publishMutation.isPending}
                      closePending={closeMutation.isPending}
                      deletePending={deleteMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Create Assignment Dialog ──────────────────────────────────── */}
      <CreateAssignmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        groups={groups}
      />
    </div>
  );
}
