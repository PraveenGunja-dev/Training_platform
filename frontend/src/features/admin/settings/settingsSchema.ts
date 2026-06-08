import { z } from 'zod';

export const settingsSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color like #6366f1'),
  doc_max_mb: z.number().int().min(1).max(500),
  image_max_mb: z.number().int().min(1).max(100),
  video_max_mb: z.number().int().min(1).max(2000),
  reminder_offsets: z.array(z.number().int().min(1)),
  session_lifetime_hours: z.number().int().min(1).max(720),
  instructors_can_view_all_classes: z.boolean().optional().default(false),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
