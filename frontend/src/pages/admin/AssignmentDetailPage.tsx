import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { assignmentsApi } from '@/api/assignments';
import { submissionsApi } from '@/api/submissions';
import { formatDate } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/states/ErrorState';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import type { LatePolicy, SubmissionStatus } from '@/lib/types';

const LATE_POLICY_LABEL: Record<LatePolicy, string> = {
  STRICT: 'Strict Deadline',
  LATE_ALLOWED: 'Late Upload Allowed',
  ADMIN_ONLY: 'Admin Only',
};

const SUBMISSION_STATUS_COLOR: Record<SubmissionStatus, string> = {
  SUBMITTED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  LATE_SUBMITTED: 'bg-amber-100 text-amber-700 border border-amber-200',
  OVERRIDE_BY_ADMIN: 'bg-sky-100 text-sky-700 border border-sky-200',
};

function deriveState(task: { is_open: boolean; upload_open_at: string; deadline_at: string }): string {
  const now = new Date();
  if (task.is_open) return 'OPEN';
  if (new Date(task.upload_open_at) > now) return 'LOCKED';
  return 'CLOSED';
}

const STATE_COLOR: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  LOCKED: 'bg-amber-100 text-amber-700 border border-amber-200',
  CLOSED: 'bg-white/8 text-muted-foreground border border-border',
};

export default function AdminAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const taskQuery = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => assignmentsApi.get(id!),
    enabled: !!id,
  });

  const submissionsQuery = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => submissionsApi.listForTask(id!),
    enabled: !!id,
  });

  if (taskQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (taskQuery.isError || !taskQuery.data?.data) {
    return <ErrorState title="Assignment not found" onRetry={() => void taskQuery.refetch()} />;
  }

  const task = taskQuery.data.data;
  const submissions = submissionsQuery.data?.data ?? [];
  const state = deriveState(task);

  return (
    <div className="space-y-6">
      <Link
        to="/admin/assignments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assignments
      </Link>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground">{task.title}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATE_COLOR[state] ?? ''}`}>
              {state.charAt(0) + state.slice(1).toLowerCase()}
            </span>
          </div>

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Submissions ({submissions.length})
            </CardTitle>
            <Link
              to={`/admin/assignments/${id}/submissions`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Review All
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {submissionsQuery.isLoading ? (
            <div className="space-y-2 p-4 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-white/8 rounded" />)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground/70">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No submissions yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{sub.user?.full_name ?? sub.user_id}</div>
                      <div className="text-xs text-muted-foreground">{sub.user?.email ?? ''}</div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate" title={sub.file_name}>{sub.file_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">v{sub.version}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SUBMISSION_STATUS_COLOR[sub.status] ?? ''}`}>
                        {sub.status.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(sub.submitted_at, 'dd MMM yyyy, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
