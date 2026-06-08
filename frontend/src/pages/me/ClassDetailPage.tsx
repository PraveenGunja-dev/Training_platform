import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { ClassHeader } from '@/features/participant/class/ClassHeader';
import { AttendanceCard } from '@/features/participant/class/AttendanceCard';
import { RelatedTasksCard } from '@/features/participant/class/RelatedTasksCard';
import { RelatedDocumentsCard } from '@/features/participant/class/RelatedDocumentsCard';

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
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
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Class not found.</p>
        <Link to="/me/calendar" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Calendar
        </Link>
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
        <div className="lg:col-span-2">
          <AttendanceCard cls={cls} />
        </div>
        <div className="space-y-4">
          <RelatedTasksCard tasks={cls.related_tasks ?? []} />
          <RelatedDocumentsCard classId={cls.id} groupId={cls.group_id} />
        </div>
      </div>
    </div>
  );
}
