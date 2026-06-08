import { format, formatDistanceToNow, differenceInSeconds, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function formatDate(iso: string, fmt = 'dd MMM yyyy, h:mm a'): string {
  const zoned = toZonedTime(parseISO(iso), LOCAL_TZ);
  return format(zoned, fmt);
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function countdown(iso: string): { hours: number; minutes: number; seconds: number } {
  const diff = Math.max(0, differenceInSeconds(parseISO(iso), new Date()));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return { hours, minutes, seconds };
}

export function formatCountdown(cd: { hours: number; minutes: number; seconds: number }): string {
  const { hours, minutes, seconds } = cd;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function toUTC(date: Date): string {
  return fromZonedTime(date, LOCAL_TZ).toISOString();
}

export function fromUTC(iso: string): Date {
  return toZonedTime(parseISO(iso), LOCAL_TZ);
}
