import { motion } from 'framer-motion';
import { Radio, CheckCircle2 } from 'lucide-react';
import { useActiveSession } from './useActiveSession';
import { useMarkAttendance } from './useMarkAttendance';
import { Button } from '@/components/ui/button';

export function AttendanceLiveBanner() {
  const { data } = useActiveSession();
  const mark = useMarkAttendance();
  const session = data?.data.session;
  const myRecord = data?.data.my_record;

  if (!session || session.status !== 'ACTIVE') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 px-5 py-4 shadow-card"
    >
      {/* subtle shimmer line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 flex-shrink-0">
            <Radio className="h-5 w-5 text-emerald-600" />
            <motion.span
              className="absolute inset-0 rounded-xl bg-emerald-400/30"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#00285A]">Attendance is now open</p>
            <p className="text-xs text-[#7C7AAE] font-medium mt-0.5">{session.class_title}</p>
          </div>
        </div>

        {myRecord ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-semibold">
              Marked at {new Date(myRecord.marked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => mark.mutate(session.id)}
            disabled={mark.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {mark.isPending ? 'Marking…' : 'Mark Attendance'}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
