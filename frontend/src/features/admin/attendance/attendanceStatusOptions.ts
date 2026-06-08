import type { AttendanceStatus } from '@/lib/types';

export const ATTENDANCE_STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'MANUAL_PRESENT', label: 'Manual Present' },
];

export const ATTENDANCE_STATUS_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  ABSENT: 'bg-rose-100 text-rose-700 border border-rose-200',
  LATE: 'bg-amber-100 text-amber-700 border border-amber-200',
  MANUAL_PRESENT: 'bg-sky-100 text-sky-700 border border-sky-200',
};
