import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SystemSettings } from '@/lib/types';

const DEFAULT_SETTINGS: SystemSettings = {
  timezone: 'UTC',
  reminder_offsets: [60, 30, 10],
  session_lifetime_hours: 24,
  sub_mentors_can_view_all_classes: false,
  attendance_drift_threshold_minutes: 30,
};

interface SettingsState {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      setSettings: (settings) => set({ settings }),
    }),
    { name: 'ems-settings' },
  ),
);
