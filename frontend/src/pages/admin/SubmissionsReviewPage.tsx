import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { assignmentsApi } from '@/api/assignments';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SubmissionsTable } from '@/features/admin/submissions/SubmissionsTable';
import { ErrorState } from '@/components/states/ErrorState';
import type { ApiEnvelope, GroupDetail, LatePolicy } from '@/lib/types';

const LATE_POLICY_BADGE: Record<LatePolicy, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' }> = {
  STRICT: { label: 'Strict Deadline', variant: 'secondary' },
  LATE_ALLOWED: { label: 'Late Allowed', variant: 'warning' },
  ADMIN_ONLY: { label: 'Admin Only', variant: 'info' },
};

export default function AdminSubmissionsReviewPage() {
  const { id } = useParams<{ id: string }>();

  const taskQuery = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => assignmentsApi.get(id!),
    enabled: !!id,
  });

  const task = taskQuery.data?.data;

  const groupDetailQuery = useQuery({
    queryKey: ['group', task?.group_id],
    queryFn: () => apiClient.get<ApiEnvelope<GroupDetail>>(`/groups/${task!.group_id}`).then(r => r.data),
    enabled: !!task?.group_id,
  });

  const participants = groupDetailQuery.data?.data?.participants ?? [];

  if (taskQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16" aria-busy="true" aria-label="Loading assignment…">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (taskQuery.isError) {
    return <ErrorState title="Failed to load assignment" onRetry={() => void taskQuery.refetch()} />;
  }

  if (!task) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Assignment not found.</p>
        <Link to="/admin/assignments" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Assignments
        </Link>
      </div>
    );
  }

  const policyBadge = LATE_POLICY_BADGE[task.late_policy];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to={`/admin/assignments/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assignment
        </Link>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{task.title} — Submissions</h1>
            <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Upload Opens</p>
              <p className="font-medium">{formatDate(task.upload_open_at, 'dd MMM yyyy, h:mm a')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Deadline</p>
              <p className="font-medium">{formatDate(task.deadline_at, 'dd MMM yyyy, h:mm a')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Group</p>
              <p className="font-medium font-mono text-xs">{task.group_id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <SubmissionsTable
            taskId={id!}
            latePolicy={task.late_policy}
            participants={participants}
            taskTitle={task.title}
          />
        </CardContent>
      </Card>
    </div>
  );
}
