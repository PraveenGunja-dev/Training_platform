import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg } from '@fullcalendar/core';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { CalendarDays, Clock, CheckCircle2, XCircle, Loader2, Filter } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { groupsApi } from '@/api/groups';
import { getEventColors } from '@/features/participant/calendar/classEventStyles';

const LEGEND = [
  { label: 'Upcoming',  color: '#0052A5', icon: CalendarDays },
  { label: 'Ongoing',   color: '#059669', icon: Clock        },
  { label: 'Completed', color: '#64748B', icon: CheckCircle2 },
  { label: 'Cancelled', color: '#E31837', icon: XCircle      },
] as const;

export function AdminCalendar() {
  const navigate = useNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const [dateRange, setDateRange] = useState(() => ({
    from: startOfMonth(new Date()).toISOString(),
    to:   endOfMonth(addMonths(new Date(), 1)).toISOString(),
  }));

  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'admin'],
    queryFn:  () => groupsApi.list({ is_archived: false }),
    staleTime: 120_000,
  });

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'calendar', dateRange.from, dateRange.to, selectedGroupId],
    queryFn:  () => classesApi.list({
      from:     dateRange.from,
      to:       dateRange.to,
      group_id: selectedGroupId || undefined,
    }),
    staleTime: 60_000,
  });

  const allClasses = data?.data ?? [];
  const groups     = groupsData?.data ?? [];

  const events = allClasses.map(c => {
    const startMs = new Date(c.starts_at).getTime();
    const endMs   = new Date(c.ends_at).getTime();
    const safeEnd = endMs - startMs > 8 * 60 * 60 * 1000
      ? new Date(startMs + 2 * 60 * 60 * 1000).toISOString()
      : c.ends_at;

    // Prepend group name when showing all groups so admin can distinguish
    const eventTitle = selectedGroupId
      ? c.title
      : `${c.group_name} — ${c.title}`;

    return {
      id:    c.id,
      title: eventTitle,
      start: c.starts_at,
      end:   safeEnd,
      extendedProps: {
        groupName: c.group_name,
        status:    c.status,
      },
      ...getEventColors(c.status),
    };
  });

  const upcomingCount  = events.filter(e => e.extendedProps.status === 'UPCOMING').length;
  const ongoingCount   = events.filter(e => e.extendedProps.status === 'ONGOING').length;
  const completedCount = events.filter(e => e.extendedProps.status === 'COMPLETED').length;

  const initialView = window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth';

  return (
    <div className="space-y-4">

      {/* ── Quick stats strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={upcomingCount}  label="Upcoming"  color="indigo"  />
        <StatCard value={ongoingCount}   label="Ongoing"   color="emerald" />
        <StatCard value={completedCount} label="Completed" color="slate"   />
      </div>

      {/* ── Calendar card ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0066BB]" />
            <h2 className="font-semibold text-slate-800 text-sm">All Classes</h2>
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

            {/* Legend */}
            <div className="hidden sm:flex items-center gap-4">
              {LEGEND.map(({ label, color }) => (
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
            eventClick={(info) => navigate(`/admin/classes/${info.event.id}`)}
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
          {LEGEND.map(({ label, color }) => (
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

/* ── Tiny stat card ───────────────────────────────────────────────────── */
interface StatCardProps {
  value: number;
  label: string;
  color: 'indigo' | 'emerald' | 'slate';
}

const colorMap = {
  indigo:  { bar: 'from-[#0052A5] to-[#3a7fd4]', bg: 'bg-[#EBF3FB]', text: 'text-[#0052A5]', num: 'text-[#00285A]', border: 'border-[#D6E8F8]' },
  emerald: { bar: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700', num: 'text-emerald-800', border: 'border-emerald-100' },
  slate:   { bar: 'from-slate-400 to-slate-500', bg: 'bg-slate-50', text: 'text-slate-500', num: 'text-slate-700', border: 'border-slate-200' },
};

function StatCard({ value, label, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} rounded-xl border ${c.border} shadow-sm overflow-hidden`}>
      <div className={`h-1 bg-gradient-to-r ${c.bar}`} />
      <div className="px-4 py-3">
        <p className={`text-2xl font-bold ${c.num}`}>{value}</p>
        <p className={`text-xs font-semibold ${c.text} mt-0.5`}>{label}</p>
      </div>
    </div>
  );
}
