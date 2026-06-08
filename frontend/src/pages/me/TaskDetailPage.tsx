import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { assignmentsApi } from '@/api/assignments';
import { groupsApi } from '@/api/groups';
import { TaskInstructions } from '@/features/participant/tasks/TaskInstructions';
import { TaskUploadCard } from '@/features/participant/tasks/TaskUploadCard';
import { TaskStateBadge, deriveTaskState } from '@/features/participant/tasks/TaskStateBadge';
import { submissionsApi } from '@/api/submissions';
import { FeedbackCard } from '@/features/participant/submissions/FeedbackCard';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: taskData, isLoading, isError } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => assignmentsApi.get(id!),
    enabled: !!id,
  });

  const { data: subsData } = useQuery({
    queryKey: ['my-submission', id],
    queryFn: () => submissionsApi.mySubmissions({ task_id: id }),
    enabled: !!id,
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (isError || !taskData?.data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Task not found.</p>
        <Link to="/me/tasks" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to My Tasks
        </Link>
      </div>
    );
  }

  const task = taskData.data;
  const mySubs = subsData?.data ?? [];
  const hasSubmission = mySubs.length > 0;
  const latestSub = mySubs.reduce<typeof mySubs[0] | undefined>((prev, cur) =>
    !prev || cur.version > prev.version ? cur : prev, undefined);
  const state = deriveTaskState(task, hasSubmission, latestSub?.status);

  const groupName = groupsData?.data?.find(g => g.id === task.group_id)?.name;

  return (
    <div className="space-y-6">
      <Link
        to="/me/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Tasks
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
          <TaskStateBadge state={state} />
        </div>
        {groupName && (
          <p className="text-sm text-muted-foreground">{groupName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <TaskInstructions task={task} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <TaskUploadCard task={task} />
          {latestSub?.review && <FeedbackCard review={latestSub.review} />}
        </div>
      </div>
    </div>
  );
}
