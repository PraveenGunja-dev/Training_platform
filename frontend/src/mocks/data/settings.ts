import type { SystemSettings } from '@/lib/types';

export const settingsMockData: SystemSettings = {
  timezone: 'UTC',
  reminder_offsets: [60, 30, 10],
  session_lifetime_hours: 24,
  sub_mentors_can_view_all_classes: false,
  attendance_drift_threshold_minutes: 30,
};
