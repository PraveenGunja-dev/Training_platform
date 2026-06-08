import { Clock, MapPin, CheckCircle2, CalendarX, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useActiveSession } from '@/features/participant/attendance/useActiveSession';
import { useMarkAttendance } from '@/features/participant/attendance/useMarkAttendance';
import { formatDate } from '@/lib/dates';
import type { TodayClassData } from '@/api/dashboard';

function getCardLabel(cls: TodayClassData['class']): string {
  if (!cls) return '';
  const now = new Date();
  const start = new Date(cls.starts_at);
  if (cls.status === 'COMPLETED') return "Last Session";
  const isToday = start.toDateString() === now.toDateString();
  return isToday ? "Today's Class" : "Upcoming Class";
}

export function TodayClassCard({ data }: { data: TodayClassData }) {
  const navigate = useNavigate();
  const cls = data.class;
  const { data: sessionData } = useActiveSession();
  const mark = useMarkAttendance();
  const session = sessionData?.data.session;
  const myRecord = sessionData?.data.my_record;
  const isLive = !!(session?.status === 'ACTIVE' && cls && session.class_id === cls.id);

  /* ── No class today ───────────────────────────────────────────────── */
  if (!cls) {
    return (
      <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card px-6 py-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#EBF3FB]">
          <CalendarX className="h-6 w-6 text-[#7C7AAE]" />
        </div>
        <div>
          <p className="font-semibold text-[#00285A]">No class today</p>
          <p className="text-sm text-[#5A7A9A] mt-0.5">Enjoy your free time — check your calendar for upcoming sessions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/me/calendar')} className="mt-1 border-[#C5D8EC] text-[#4F46E5]">
          View Calendar <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }

  /* ── Class scheduled or live ──────────────────────────────────────── */
  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">

      {/* Gradient header */}
      <div
        className="relative px-5 py-5 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)' }}
      >
        {/* Background decoration */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/8" />
        <div className="absolute -right-2 -bottom-10 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-indigo-200 text-[11px] font-semibold uppercase tracking-widest mb-1">
              {getCardLabel(cls)}
            </p>
            <h2 className="text-white font-bold text-lg leading-snug">{cls.title}</h2>
            <p className="text-indigo-200 text-sm mt-1">{cls.group_name}</p>
          </div>

          {isLive && (
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 flex-shrink-0">
              <motion.span
                className="w-2 h-2 rounded-full bg-emerald-300"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              <span className="text-white text-xs font-semibold">LIVE</span>
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-4 mt-4 text-indigo-200 text-sm">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(cls.starts_at, 'h:mm a')} – {formatDate(cls.ends_at, 'h:mm a')}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {cls.group_name}
          </span>
        </div>
      </div>

      {/* Bottom action row */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 bg-white">
        {isLive ? (
          myRecord ? (
            <div className="flex items-center gap-2.5 text-emerald-600">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Attendance marked</p>
                <p className="text-xs text-emerald-500">
                  at {new Date(myRecord.marked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-[#7C7AAE]">Session is live — mark your attendance</p>
              <Button
                size="sm"
                onClick={() => mark.mutate(session!.id)}
                disabled={mark.isPending}
              >
                {mark.isPending ? 'Marking…' : 'Mark Attendance'}
              </Button>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-[#7C7AAE]">
              {cls.status === 'COMPLETED'
                ? 'Session completed'
                : `${formatDate(cls.starts_at, 'EEE, dd MMM')} at ${formatDate(cls.starts_at, 'h:mm a')}`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/me/classes/${cls.id}`)}
              className="text-[#0052A5] hover:text-[#0052A5] hover:bg-blue-50"
            >
              Details <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
