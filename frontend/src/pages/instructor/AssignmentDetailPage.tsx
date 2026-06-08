import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Send, X as XIcon, Edit2 } from 'lucide-react';
import { assignmentsApi } from '@/api/assignments';
import { formatDate } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/states/ErrorState';
import { SubmissionsTable } from '@/features/admin/submissions/SubmissionsTable';
import { useCan } from '@/hooks/useCan';
import type { LatePolicy } from '@/lib/types';

const LATE_POLICY_LABEL: Record<LatePolicy, string> = {
  STRICT: 'Strict Deadline',
  LATE_ALLOWED: 'Late Upload Allowed',
  ADMIN_ONLY: 'Admin Only',
};

function deriveState(task: { is_open: boolean; is_closed: boolean; upload_open_at: string }): string {
  if (task.is_closed) return 'CLOSED';
  if (task.is_open || new Date(task.upload_open_at) <= new Date()) return 'OPEN';
  return 'LOCKED';
}

const STATE_COLOR: Record<string, string> = {
  OPEN:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
  LOCKED: 'bg-amber-100 text-amber-700 border border-amber-200',
  CLOSED: 'bg-white/8 text-muted-foreground border border-border',
};

export default function InstructorAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const taskQuery = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => assignmentsApi.get(id!),
    enabled: !!id,
  });

  const task   = taskQuery.data?.data;
  const state  = task ? deriveState(task) : '';

  const canPublish = useCan('publish', 'assignment', { group_id: task?.group_id });
  const canEdit    = useCan('edit',    'assignment', { group_id: task?.group_id });
  const canDelete  = useCan('delete',  'assignment', { group_id: task?.group_id });

  const publishMutation = useMutation({
    mutationFn: () => assignmentsApi.update(id!, { is_open: true } as never),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignment', id] });
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
    mutationFn: () => assignmentsApi.close(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignment', id] });
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
    mutationFn: () => assignmentsApi.delete(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment deleted.');
      navigate('/instructor/assignments');
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

  if (taskQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (taskQuery.isError || !task) {
    return <ErrorState title="Assignment not found" onRetry={() => void taskQuery.refetch()} />;
  }

  const isMutating = publishMutation.isPending || closeMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <Link
        to="/instructor/assignments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assignments
      </Link>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Title + state badge + action buttons */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{task.title}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${STATE_COLOR[state] ?? ''}`}>
                {state.charAt(0) + state.slice(1).toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {state === 'LOCKED' && canPublish && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 gap-1.5"
                  onClick={() => publishMutation.mutate()}
                  disabled={isMutating}
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish
                </Button>
              )}
              {state === 'OPEN' && canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-slate-600 border-slate-200 hover:bg-slate-100 gap-1.5"
                  onClick={() => closeMutation.mutate()}
                  disabled={isMutating}
                >
                  <XIcon className="h-3.5 w-3.5" />
                  Close
                </Button>
              )}
              {state === 'LOCKED' && canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[#0052A5] border-blue-200 hover:bg-blue-50 gap-1.5"
                  disabled={isMutating}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              {state === 'LOCKED' && canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                  onClick={() => deleteMutation.mutate()}
                  disabled={isMutating}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Group</p>
              <p className="font-medium">{task.group_name || task.group_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Class</p>
              <p className="font-medium">{task.class_title ?? <span className="text-muted-foreground/50">Not linked</span>}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Late Policy</p>
              <p className="font-medium">{LATE_POLICY_LABEL[task.late_policy]}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Upload Opens</p>
              <p className="font-medium">{formatDate(task.upload_open_at, 'dd MMM yyyy, h:mm a')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Deadline</p>
              <p className="font-medium">{formatDate(task.deadline_at, 'dd MMM yyyy, h:mm a')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Reminders</p>
              <p className="font-medium">{task.reminder_offsets.length ? task.reminder_offsets.map(o => `${o}m`).join(', ') : '—'}</p>
            </div>
          </div>

          {task.question && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Question</p>
              <p className="text-sm text-foreground">{task.question}</p>
            </div>
          )}

          {task.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground/90">{task.description}</p>
            </div>
          )}

          {task.instructions && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Instructions</p>
              <p className="text-sm text-foreground/90">{task.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SubmissionsTable
            taskId={task.id}
            latePolicy={task.late_policy}
            participants={[]}
            taskTitle={task.title}
          />
        </CardContent>
      </Card>
    </div>
  );
}
