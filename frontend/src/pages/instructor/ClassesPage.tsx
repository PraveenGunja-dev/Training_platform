import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, ArrowRight, Users, Plus } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { ScheduleClassDialog } from '@/features/admin/scheduling/ScheduleClassDialog';
import { useCan } from '@/hooks/useCan';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/states/ErrorState';
import type { ClassSession, ClassStatus } from '@/lib/types';

const STATUS_CONFIG: Record<ClassStatus, {
  label:   string;
  badge:   string;
  gradient: string;
  dot:     string;
  sortOrder: number;
}> = {
  ONGOING:   { label: 'Live',      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200', gradient: 'from-emerald-500 to-teal-400',   dot: 'bg-emerald-400', sortOrder: 0 },
  UPCOMING:  { label: 'Upcoming',  badge: 'bg-white/25 text-white border border-white/30',             gradient: 'from-[#0052A5] to-[#E31837]',    dot: 'bg-indigo-400',  sortOrder: 1 },
  COMPLETED: { label: 'Completed', badge: 'bg-white/25 text-white border border-white/30',             gradient: 'from-slate-500 to-slate-400',    dot: 'bg-slate-400',   sortOrder: 2 },
  CANCELLED: { label: 'Cancelled', badge: 'bg-rose-100 text-rose-700 border border-rose-200',          gradient: 'from-rose-400 to-rose-300',      dot: 'bg-rose-400',    sortOrder: 3 },
};

const STAT_BADGE: Record<ClassStatus, string> = {
  UPCOMING:  'bg-blue-50 text-[#0052A5] border-blue-200',
  ONGOING:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-[#EBF3FB] text-[#7C7AAE] border-[#C5D8EC]',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
};

function sortClasses(list: ClassSession[]): ClassSession[] {
  return [...list].sort((a, b) => {
    const orderDiff = (STATUS_CONFIG[a.status]?.sortOrder ?? 9) - (STATUS_CONFIG[b.status]?.sortOrder ?? 9);
    if (orderDiff !== 0) return orderDiff;
    if (a.status === 'COMPLETED') return new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime();
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  });
}

function ClassCard({ cls }: { cls: ClassSession }) {
  const cfg = STATUS_CONFIG[cls.status] ?? STATUS_CONFIG.COMPLETED;
  const isLive = cls.status === 'ONGOING';
  const attendanceLive = cls.active_session?.status === 'ACTIVE';

  return (
    <>
      <Link
        to={`/instructor/classes/${cls.id}`}
        className="group flex flex-col rounded-2xl border border-[#C5D8EC] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden"
      >
        {/* Gradient header */}
        <div className={`relative px-4 pt-4 pb-5 bg-gradient-to-br ${cfg.gradient} overflow-hidden`}>
          <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-4 -right-2 w-14 h-14 rounded-full bg-white/8 pointer-events-none" />

          {/* Status + group row */}
          <div className="relative flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
                {isLive && (
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                )}
                {cfg.label}
              </span>
              {attendanceLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500 text-white">
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                  </span>
                  Attendance
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold text-white/80 bg-white/15 px-2 py-0.5 rounded-lg truncate max-w-[130px]">
              {cls.group_name}
            </span>
          </div>

          {/* Title */}
          <div className="relative">
            <h3 className="font-bold text-white text-sm leading-snug line-clamp-2 group-hover:opacity-90 transition-opacity">
              {cls.title}
            </h3>
            {cls.description && (
              <p className="text-white/60 text-[11px] mt-1 line-clamp-1">{cls.description}</p>
            )}
          </div>
        </div>

        {/* Details body */}
        <div className="flex flex-col flex-1 bg-white px-4 py-3.5 gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-medium text-slate-700">{formatDate(cls.starts_at, 'EEE, dd MMM yyyy')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span>{formatDate(cls.starts_at, 'h:mm a')} – {formatDate(cls.ends_at, 'h:mm a')}</span>
          </div>
          {(cls.participants_count ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span>{cls.participants_count} participant{cls.participants_count !== 1 ? 's' : ''}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-100">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0052A5] group-hover:gap-2 transition-all duration-150 ml-auto">
              View <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>
    </>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-[#C5D8EC] overflow-hidden animate-pulse">
          <div className="h-24 bg-slate-200" />
          <div className="bg-white p-4 space-y-2.5">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-2/3 bg-slate-100 rounded" />
            <div className="h-3 w-1/2 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InstructorClassesPage() {
  const [selectedGroup, setSelectedGroup]   = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [scheduleOpen, setScheduleOpen]     = useState(false);

  const canCreate = useCan('create', 'class');

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn:  () => groupsApi.list(),
  });
  const groups = groupsQuery.data?.data ?? [];

  const classesQuery = useQuery({
    queryKey: ['classes', { group_id: selectedGroup }],
    queryFn:  () =>
      classesApi.list({
        group_id: selectedGroup !== 'all' ? selectedGroup : undefined,
      }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const rawClasses = useMemo(() => classesQuery.data?.data ?? [], [classesQuery.data?.data]);

  const counts: Record<ClassStatus, number> = useMemo(() => ({
    UPCOMING:  rawClasses.filter(c => c.status === 'UPCOMING').length,
    ONGOING:   rawClasses.filter(c => c.status === 'ONGOING').length,
    COMPLETED: rawClasses.filter(c => c.status === 'COMPLETED').length,
    CANCELLED: rawClasses.filter(c => c.status === 'CANCELLED').length,
  }), [rawClasses]);

  const filtered = useMemo(
    () => selectedStatus !== 'all' ? rawClasses.filter(c => c.status === selectedStatus) : rawClasses,
    [rawClasses, selectedStatus],
  );
  const classes   = useMemo(() => sortClasses(filtered), [filtered]);
  const isLoading = groupsQuery.isLoading || classesQuery.isLoading;
  const isError   = groupsQuery.isError   || classesQuery.isError;

  const handleRetry = () => {
    if (groupsQuery.isError)  void groupsQuery.refetch();
    if (classesQuery.isError) void classesQuery.refetch();
  };

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
            <CalendarDays className="h-5 w-5 text-[#0052A5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#00285A] leading-tight">Classes</h1>
            <p className="text-sm text-slate-500">All class sessions across your assigned groups.</p>
          </div>
        </div>
        {canCreate && (
          <Button
            onClick={() => setScheduleOpen(true)}
            className="gap-1.5"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Schedule Class
          </Button>
        )}
      </div>

      {canCreate && (
        <ScheduleClassDialog
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          groups={groupsQuery.data?.data ?? []}
        />
      )}

      {/* Stats strip */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {((['ONGOING', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as ClassStatus[])).map(status => {
            const cfg = STATUS_CONFIG[status];
            const active = selectedStatus === status;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(active ? 'all' : status)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  active
                    ? `${STAT_BADGE[status]} border ring-2 ring-offset-1 ring-current`
                    : 'bg-white border-[#C5D8EC] hover:border-blue-200 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div>
                  <p className="text-xs text-slate-500 leading-none mb-0.5">{cfg.label}</p>
                  <p className="text-xl font-bold text-[#00285A] tabular-nums leading-none">{counts[status]}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-52 bg-white border-[#C5D8EC]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40 bg-white border-[#C5D8EC]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
            <SelectItem value="ONGOING">Ongoing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {!isLoading && !isError && (
          <span className="ml-auto text-sm text-slate-400">
            {filtered.length} class{filtered.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <CardsSkeleton />
      ) : isError ? (
        <ErrorState title="Failed to load classes" onRetry={handleRetry} />
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50">
            <CalendarDays className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No classes found.</p>
            <p className="text-xs text-slate-400 mt-1">
              {selectedGroup !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters.'
                : 'No classes scheduled yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes.map(cls => <ClassCard key={cls.id} cls={cls} />)}
        </div>
      )}
    </div>
  );
}
