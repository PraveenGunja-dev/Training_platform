import { z } from 'zod';

export const scheduleSchema = z.object({
  group_id: z.string().min(1, 'Group is required'),
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(1000).optional(),
  meeting_link: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v) || undefined,
    z.string().url('Must be a valid URL (e.g. https://meet.google.com/...)').optional(),
  ),
  date: z.date({ required_error: 'Date is required' }),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  allow_late_attendance: z.boolean().default(false),
}).refine(d => d.end_time > d.start_time, {
  path: ['end_time'],
  message: 'End time must be after start time',
});

export type ScheduleFormValues = z.infer<typeof scheduleSchema>;
