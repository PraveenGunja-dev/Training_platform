import { z } from 'zod';

export const settingsSchema = z.object({
  timezone: z.string().min(1, 'Timezone is required'),
  reminder_offsets: z.array(z.number().int().min(1)),
  session_lifetime_hours: z.number().int().min(1).max(720),
  sub_mentors_can_view_all_classes: z.boolean().optional().default(false),
  attendance_drift_threshold_minutes: z.number().int().min(1).max(120),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
