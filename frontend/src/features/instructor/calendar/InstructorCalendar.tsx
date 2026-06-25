import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg } from '@fullcalendar/core';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { CalendarDays, Clock, CheckCircle2, XCircle, Loader2, Filter, Eye, Info } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { instructorApi } from '@/api/instructor';
import { getEventColors } from '@/features/participant/calendar/classEventStyles';

const MUTED_COLORS = {
  backgroundColor: '#CBD5E1',
  borderColor: '#94A3B8',
  textColor: '#475569',
};

const LEGEND = [
  { label: 'Upcoming',  color: '#4F46E5', icon: CalendarDays },
  { label: 'Ongoing',   color: '#059669', icon: Clock        },
  { label: 'Completed', color: '#64748B', icon: CheckCircle2 },
  { label: 'Cancelled', color: '#E11D48', icon: XCircle      },
  { label: 'View only', color: '#CBD5E1', icon: Eye          },
] as const;

export function InstructorCalendar() {
  const navigate = useNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const [dateRange, setDateRange] = useState(() => ({
    from: startOfMonth(new Date()).toISOString(),
    to:   endOfMonth(addMonths(new Date(), 1)).toISOString(),
  }));

  const { data: groupsData } = useQuery({
    queryKey: ['instructor', 'my-groups'],
    queryFn:  () => instructorApi.myGroups(),
    staleTime: 120_000,
  });

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['instructor', 'calendar', dateRange.from, dateRange.to, selectedGroupId],
    queryFn:  () => classesApi.list({
      from:      dateRange.from,
      to:        dateRange.to,
      group_id:  selectedGroupId || undefined,
      page_size: 1000,
    }),
    staleTime: 60_000,
  });

  const allClasses = data?.data ?? [];
  const groups     = groupsData?.data ?? [];
  const effectiveCanViewAll = groupsData?.effective_can_view_all ?? false;

  const events = allClasses.map(c => {
    const startMs = new Date(c.starts_at).getTime();
    const endMs   = new Date(c.ends_at).getTime();
    const safeEnd = endMs - startMs > 8 * 60 * 60 * 1000
      ? new Date(startMs + 2 * 60 * 60 * 1000).toISOString()
      : c.ends_at;

    const baseTitle = selectedGroupId
      ? c.title
      : `${c.group_name} — ${c.title}`;

    const eventTitle = c.read_only ? `View only — ${baseTitle}` : baseTitle;
    const colors = c.read_only ? MUTED_COLORS : getEventColors(c.status);

    return {
      id:    c.id,
      title: eventTitle,
      start: c.starts_at,
      end:   safeEnd,
      extendedProps: {
        groupName: c.group_name,
        status:    c.status,
        read_only: c.read_only ?? false,
      },
      ...colors,
    };
  });

  const upcomingCount  = events.filter(e => e.extendedProps.status === 'UPCOMING'   && !e.extendedProps.read_only).length;
  const ongoingCount   = events.filter(e => e.extendedProps.status === 'ONGOING'    && !e.extendedProps.read_only).length;
  const completedCount = events.filter(e => e.extendedProps.status === 'COMPLETED'  && !e.extendedProps.read_only).length;
  const readOnlyCount  = events.filter(e => e.extendedProps.read_only).length;

  const initialView = window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth';

  return (
    <div className="space-y-4">

      {/* Cross-visibility info banner */}
      {effectiveCanViewAll && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-[#0052A5]"
          role="note"
          aria-label="cross-visibility notice"
        >
          <Info className="h-4 w-4 shrink-0 text-[#0066BB]" />
          <span>
            You're seeing classes from all instructors. You can only edit your own.
          </span>
        </div>
      )}

      {/* Quick stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={upcomingCount}  label="Upcoming"  color="indigo"  />
        <StatCard value={ongoingCount}   label="Ongoing"   color="emerald" />
        <StatCard value={completedCount} label="Completed" color="slate"   />
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">

        {/* Beautiful loading overlay — initial fetch only */}
        {isPending && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 rounded-2xl">
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-[3px] border-blue-50" />
                <div className="absolute inset-0 rounded-full border-[3px] border-t-indigo-500 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CalendarDays className="h-7 w-7 text-indigo-500" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-[#00285A]">Loading Calendar</p>
                <p className="text-xs text-slate-500">Fetching your assigned classes…</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0066BB]" />
            <h2 className="font-semibold text-slate-800 text-sm">
              {effectiveCanViewAll ? "All instructors' classes" : 'Your assigned classes'}
            </h2>
            {isFetching && (
              <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Group filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              >
                <option value="">All Groups</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Legend — show "View only" entry only when there are cross-visibility events */}
            <div className="hidden sm:flex items-center gap-4">
              {LEGEND.filter(l => l.label !== 'View only' || readOnlyCount > 0).map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-slate-500 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FullCalendar */}
        <div className="p-4 sm:p-5">
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView={initialView}
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,listWeek',
            }}
            events={events}
            eventClick={(info) => navigate(`/instructor/classes/${info.event.id}`)}
            datesSet={(arg: DatesSetArg) =>
              setDateRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })
            }
            height="auto"
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
            noEventsContent="No classes scheduled for this period."
            dayMaxEvents={3}
            eventDisplay="block"
          />
        </div>

        {/* Mobile legend */}
        <div className="sm:hidden flex flex-wrap gap-3 px-5 pb-4">
          {LEGEND.filter(l => l.label !== 'View only' || readOnlyCount > 0).map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-slate-500 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Tiny stat card */
interface StatCardProps {
  value: number;
  label: string;
  color: 'indigo' | 'emerald' | 'slate';
}

const colorMap = {
  indigo:  { bg: 'bg-blue-50',  text: 'text-[#0052A5]',  num: 'text-[#0052A5]'  },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', num: 'text-emerald-600' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-600',   num: 'text-slate-700'   },
};

function StatCard({ value, label, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} rounded-xl px-4 py-3 border border-white shadow-sm`}>
      <p className={`text-2xl font-bold ${c.num}`}>{value}</p>
      <p className={`text-xs font-medium ${c.text} mt-0.5`}>{label}</p>
    </div>
  );
}
