import { useReducer, useEffect } from 'react';
import { Timer, Clock } from 'lucide-react';

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface Props {
  startedAt: string;
  scheduledEndAt?: string | null;
}

export function SessionTimer({ startedAt, scheduledEndAt }: Props) {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const id = setInterval(() => {
      if (scheduledEndAt && new Date(scheduledEndAt).getTime() - Date.now() <= 0) {
        clearInterval(id);
        return;
      }
      forceUpdate();
    }, 1000);
    return () => clearInterval(id);
  }, [scheduledEndAt]);

  if (scheduledEndAt) {
    const remaining = Math.max(0, Math.floor((new Date(scheduledEndAt).getTime() - Date.now()) / 1000));
    const isUrgent = remaining <= 60;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border tabular-nums ${
        isUrgent
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-teal-50 text-teal-700 border-teal-200'
      }`}>
        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
        {formatSeconds(remaining)} left
      </span>
    );
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-teal-50 text-teal-700 border border-teal-200 tabular-nums">
      <Timer className="h-3.5 w-3.5 flex-shrink-0" />
      {formatSeconds(elapsed)}
    </span>
  );
}
