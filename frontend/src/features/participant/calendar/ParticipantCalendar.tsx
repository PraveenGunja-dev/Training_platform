import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg } from '@fullcalendar/core';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { CalendarDays, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { getEventColors } from './classEventStyles';

const LEGEND = [
  { label: 'Upcoming',  color: '#4F46E5', icon: CalendarDays },
  { label: 'Ongoing',   color: '#059669', icon: Clock        },
  { label: 'Completed', color: '#64748B', icon: CheckCircle2 },
  { label: 'Cancelled', color: '#E11D48', icon: XCircle      },
] as const;

export function ParticipantCalendar() {
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState(() => ({
    from: startOfMonth(new Date()).toISOString(),
    to:   endOfMonth(addMonths(new Date(), 1)).toISOString(),
  }));

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['me', 'calendar', dateRange.from, dateRange.to],
    queryFn:  () => classesApi.myCalendar({ from: dateRange.from, to: dateRange.to }),
    staleTime: 60_000,
  });

  const events = (data?.data ?? []).map(c => {
    const startMs = new Date(c.starts_at).getTime();
    const endMs   = new Date(c.ends_at).getTime();
    // If ends_at is a sentinel / unreasonably long (> 8 h), cap at start + 2 h for display
    const safeEnd = endMs - startMs > 8 * 60 * 60 * 1000
      ? new Date(startMs + 2 * 60 * 60 * 1000).toISOString()
      : c.ends_at;

    return {
      id:    c.id,
      title: c.title,
      start: c.starts_at,
      end:   safeEnd,
      extendedProps: {
        groupName:        c.group_name,
        status:           c.status,
        attendanceStatus: c.attendance_status,
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
        <StatCard value={upcomingCount}  label="Upcoming"  color="indigo" />
        <StatCard value={ongoingCount}   label="Ongoing"   color="emerald" />
        <StatCard value={completedCount} label="Completed" color="slate" />
      </div>

      {/* ── Calendar card ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden relative">

        {/* Beautiful loading overlay — initial fetch only */}
        {isPending && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 rounded-2xl">
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-[3px] border-[#EBF3FB]" />
                <div className="absolute inset-0 rounded-full border-[3px] border-t-[#0052A5] border-r-[#0052A5] border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CalendarDays className="h-7 w-7 text-[#0052A5]" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-[#00285A]">Loading Calendar</p>
                <p className="text-xs text-slate-500">Fetching your schedule…</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#0052A5] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0066BB]" />
            <h2 className="font-semibold text-slate-800 text-sm">My Schedule</h2>
            {isFetching && (
              <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
            )}
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
            eventClick={(info) => navigate(`/me/classes/${info.event.id}`)}
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
