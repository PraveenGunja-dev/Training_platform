import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, XCircle, CheckCircle2, Users, CalendarDays, Clock, MapPin, ClipboardList, Video, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { classesApi } from '@/api/classes';
import { formatDate } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { RelatedTasksCard } from '@/features/participant/class/RelatedTasksCard';
import { ClassDocumentUploadCard } from '@/features/admin/class/ClassDocumentUploadCard';
import { ErrorState } from '@/components/states/ErrorState';
import { StartAttendanceDialog } from '@/features/admin/attendance/StartAttendanceDialog';
import { EndAttendanceDialog } from '@/features/admin/attendance/EndAttendanceDialog';
import { SessionTimer } from '@/features/admin/attendance/SessionTimer';
import { ClassAttendancePanel } from '@/features/admin/attendance/ClassAttendancePanel';
import { CreateAssignmentDialog } from '@/features/admin/assignments/CreateAssignmentDialog';
import { EditClassDialog } from '@/features/admin/class/EditClassDialog';
import { CancelClassDialog } from '@/features/admin/class/CancelClassDialog';
import { ClassSubmissionsPanel } from '@/features/admin/class/ClassSubmissionsPanel';
import { ClassAttendanceHistory } from '@/features/admin/attendance/ClassAttendanceHistory';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  UPCOMING:  { label: 'Upcoming',  className: 'bg-blue-50 text-[#0052A5] border border-blue-200'   },
  ONGOING:   { label: 'Ongoing',   className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  COMPLETED: { label: 'Completed', className: 'bg-[#EBF3FB] text-[#7C7AAE] border border-[#C5D8EC]'     },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 border border-rose-200'          },
};

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-28 bg-[#EBF3FB] rounded" />
      <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card p-6 space-y-4">
        <div className="h-6 w-64 bg-[#EBF3FB] rounded" />
        <div className="h-4 w-40 bg-[#EBF3FB] rounded" />
        <div className="grid grid-cols-3 gap-4 pt-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-[#EBF3FB] rounded-xl" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#C5D8EC] shadow-card h-64" />
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card h-32" />
          <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card h-32" />
        </div>
      </div>
    </div>
  );
}

export default function AdminClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [cancelOpen, setCancelOpen]     = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['class', id],
    queryFn: () => classesApi.get(id!),
    enabled: !!id,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const markCompleted = useMutation({
    mutationFn: () => classesApi.update(data!.data!.id, { status: 'COMPLETED' } as never),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class', id] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class marked as completed.');
    },
    onError: () => toast.error('Failed to update class status.'),
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data?.data) {
    return <ErrorState title="Class not found" onRetry={() => void refetch()} />;
  }

  const cls = data.data;
  const badge = STATUS_BADGE[cls.status] ?? STATUS_BADGE.COMPLETED;

  const canStartAttendance =
    !cls.active_session &&
    cls.status !== 'CANCELLED' &&
    cls.status !== 'COMPLETED';

  return (
    <div className="space-y-6">

      {/* ── Back link ────────────────────────────────────────────────── */}
      <Link
        to="/admin/classes"
        className="inline-flex items-center gap-1.5 text-sm text-[#5A7A9A] hover:text-[#00285A] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Classes
      </Link>

      {/* ── Hero card ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">

        {/* Gradient header strip */}
        <div
          className="relative px-6 py-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)' }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/8 pointer-events-none" />
          <div className="absolute -bottom-4 -right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest">Class Session</p>
              <h1 className="text-xl font-bold text-white leading-snug">{cls.title}</h1>
              <p className="text-sm text-indigo-200">{cls.group_name}</p>
              {cls.description && (
                <p className="text-sm text-indigo-200/80 mt-1">{cls.description}</p>
              )}
            </div>
            <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm border-b border-[#EBF3FB]">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 flex-shrink-0">
              <CalendarDays className="h-3.5 w-3.5 text-[#0066BB]" />
            </div>
            <div>
              <p className="text-xs text-[#5A7A9A]">Date</p>
              <p className="font-semibold text-[#00285A]">{formatDate(cls.starts_at, 'dd MMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-50 flex-shrink-0">
              <Clock className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs text-[#5A7A9A]">Time</p>
              <p className="font-semibold text-[#00285A]">
                {formatDate(cls.starts_at, 'h:mm a')} – {formatDate(cls.ends_at, 'h:mm a')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 flex-shrink-0">
              <MapPin className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-[#5A7A9A]">Group</p>
              <p className="font-semibold text-[#00285A]">{cls.group_name}</p>
            </div>
          </div>
        </div>

        {/* Meeting Link row */}
        {cls.meeting_link && (
          <div className="px-6 py-3 flex items-center gap-3 border-b border-[#EBF3FB] bg-emerald-50/60">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 flex-shrink-0">
              <Video className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#5A7A9A] mb-0.5">Meeting Link</p>
              <a
                href={cls.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0052A5] hover:underline truncate block"
              >
                {cls.meeting_link}
              </a>
            </div>
            <a
              href={cls.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Join
            </a>
          </div>
        )}

        {/* Action row */}
        <div className="px-6 py-3.5 flex items-center gap-2 flex-wrap">
          {canStartAttendance && (
            <StartAttendanceDialog
              classId={cls.id}
              className={cls.title}
              participantCount={cls.participants_count ?? 0}
            />
          )}
          {cls.active_session?.status === 'ACTIVE' && (
            <>
              <EndAttendanceDialog sessionId={cls.active_session.id} />
              <SessionTimer startedAt={cls.active_session.started_at} scheduledEndAt={cls.active_session.scheduled_end_at} />
            </>
          )}
          <Button
            size="sm"
            onClick={() => setAllocateOpen(true)}
          >
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Allocate Assignment
          </Button>
          {cls.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              className="border-[#C5D8EC] text-[#00285A] hover:bg-[#EBF3FB]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
          {cls.status !== 'CANCELLED' && cls.status !== 'COMPLETED' && (
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
              disabled={markCompleted.isPending}
              onClick={() => markCompleted.mutate()}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {markCompleted.isPending ? 'Updating…' : 'Mark Completed'}
            </Button>
          )}
          {cls.status !== 'CANCELLED' && cls.status !== 'COMPLETED' && (
            <Button
              variant="outline"
              size="sm"
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* ── Attendance + sidebar ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Attendance panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[#EBF3FB]">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50">
                  <Users className="h-3.5 w-3.5 text-[#0066BB]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#00285A] leading-tight">Attendance</p>
                  <p className="text-xs text-[#5A7A9A]">Live participant attendance for this session</p>
                </div>
              </div>
              {cls.active_session?.status === 'ACTIVE' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse inline-block" />
                  Live
                </span>
              )}
            </div>
            <div className="p-5">
              <ClassAttendancePanel activeSession={cls.active_session ?? null} />
            </div>
          </div>
        </div>

        {/* Related tasks + documents */}
        <div className="space-y-4">
          <RelatedTasksCard tasks={cls.related_tasks ?? []} linkPrefix="/admin/assignments" />
          <ClassDocumentUploadCard classId={cls.id} groupId={cls.group_id} />
        </div>
      </div>

      {/* ── Attendance History ──────────────────────────────────────── */}
      <ClassAttendanceHistory
        classId={cls.id}
        reportBasePath="/admin/attendance/sessions"
      />

      {/* ── Assignment Submissions ───────────────────────────────────── */}
      <ClassSubmissionsPanel classId={cls.id} groupId={cls.group_id} />

      {/* Allocate Assignment dialog — group + class pre-filled from this class */}
      <CreateAssignmentDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        groups={[{ id: cls.group_id, name: cls.group_name, description: '', participants_count: 0, is_archived: false, created_at: '' }]}
        defaultGroupId={cls.group_id}
        defaultClassId={cls.id}
      />

      <EditClassDialog
        cls={cls}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      <CancelClassDialog
        classId={cls.id}
        classTitle={cls.title}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}
