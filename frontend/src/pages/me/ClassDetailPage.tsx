import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { ClassHeader } from '@/features/participant/class/ClassHeader';
import { AttendanceCard } from '@/features/participant/class/AttendanceCard';
import { RelatedTasksCard } from '@/features/participant/class/RelatedTasksCard';
import { RelatedDocumentsCard } from '@/features/participant/class/RelatedDocumentsCard';
import { FeedbackFormCard } from '@/features/participant/class/FeedbackFormCard';

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['class', id],
    queryFn: () => classesApi.get(id!),
    enabled: !!id,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (isError || !data?.data) {
    const is404 = (error as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-muted-foreground">
          {is404 ? 'Class not found.' : 'Something went wrong loading this class.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          {!is404 && (
            <button
              onClick={() => void refetch()}
              className="text-sm text-[#0052A5] hover:underline"
            >
              Try again
            </button>
          )}
          <Link to="/me/calendar" className="text-sm text-[#5A7A9A] hover:underline">
            Back to Calendar
          </Link>
        </div>
      </div>
    );
  }

  const cls = data.data;

  return (
    <div className="space-y-6">
      <Link
        to="/me/calendar"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Calendar
      </Link>

      <ClassHeader cls={cls} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <AttendanceCard cls={cls} />
          {cls.status === 'COMPLETED' && <FeedbackFormCard cls={cls} />}
        </div>
        <div className="space-y-4">
          <RelatedTasksCard tasks={cls.related_tasks ?? []} />
          <RelatedDocumentsCard classId={cls.id} groupId={cls.group_id} />
        </div>
      </div>
    </div>
  );
}
