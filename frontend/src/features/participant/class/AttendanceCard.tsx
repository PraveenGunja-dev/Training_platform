import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MotionButton } from '@/components/motion/MotionButton';
import { UnlockAnimation } from '@/components/motion/UnlockAnimation';
import { useActiveSession } from '@/features/participant/attendance/useActiveSession';
import { useMarkAttendance } from '@/features/participant/attendance/useMarkAttendance';
import type { ClassSession } from '@/lib/types';

export function AttendanceCard({ cls }: { cls: ClassSession }) {
  const { data } = useActiveSession();
  const mark = useMarkAttendance();
  const session = data?.data.session;
  const myRecord = data?.data.my_record;
  const [showUnlock, setShowUnlock] = useState(false);

  // Fire UnlockAnimation exactly once when session flips from null → active for this class
  const [prevSessionId, setPrevSessionId] = useState<string | null>(null);
  useEffect(() => {
    const currId = session?.id ?? null;
    if (!prevSessionId && currId && session?.status === 'ACTIVE' && session.class_id === cls.id && !myRecord) {
      setShowUnlock(true);
    }
    setPrevSessionId(currId);
  }, [session, myRecord, prevSessionId, cls.id]);

  // State 1: no active session for this class (or session belongs to different class)
  if (!session || session.class_id !== cls.id || session.status !== 'ACTIVE') {
    if (myRecord && myRecord.session_id) {
      return (
        <Card>
          <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
          <CardContent>
            <span className="rounded-md bg-brand-teal/15 px-3 py-1 text-sm text-brand-teal font-mono">
              ✓ Marked at {new Date(myRecord.marked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/50">Attendance has not started yet.</p>
          <MotionButton disabled className="mt-3" variant="outline">Mark Attendance</MotionButton>
        </CardContent>
      </Card>
    );
  }

  // State 2: active session + not yet marked → big enabled button with UnlockAnimation
  if (!myRecord) {
    return (
      <Card>
        <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
        <CardContent>
          <div className="relative">
            <UnlockAnimation active={showUnlock} onComplete={() => setShowUnlock(false)} />
            <MotionButton size="lg" onClick={() => mark.mutate(session.id)} disabled={mark.isPending}>
              {mark.isPending ? 'Marking…' : 'Mark Attendance'}
            </MotionButton>
          </div>
          <p className="mt-2 text-xs text-foreground/60">
            Session started at {new Date(session.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} by {session.started_by.full_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  // State 3: active session + already marked
  return (
    <Card>
      <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
      <CardContent>
        <span className="rounded-md bg-brand-teal/15 px-3 py-1 text-sm text-brand-teal">
          ✓ Marked at <span className="font-mono">{new Date(myRecord.marked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
        </span>
      </CardContent>
    </Card>
  );
}
