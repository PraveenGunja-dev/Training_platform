import { useState, useEffect } from 'react';
import { countdown } from '@/lib/dates';

export function useCountdown(targetISO: string | null | undefined) {
  const [remaining, setRemaining] = useState(() =>
    targetISO ? countdown(targetISO) : { hours: 0, minutes: 0, seconds: 0 },
  );

  useEffect(() => {
    if (!targetISO) return;
    setRemaining(countdown(targetISO));
    const id = setInterval(() => setRemaining(countdown(targetISO)), 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  return remaining;
}
