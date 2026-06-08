import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SystemSettings } from '@/lib/types';

const DEFAULT_SETTINGS: SystemSettings = {
  product_name: 'ACLP Training Management System',
  timezone: 'UTC',
  brand_color: '#6366f1',
  doc_max_mb: 25,
  image_max_mb: 10,
  video_max_mb: 500,
  reminder_offsets: [60, 30, 10],
  session_lifetime_hours: 24,
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
