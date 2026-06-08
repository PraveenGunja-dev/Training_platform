import { z } from 'zod';

const isFutureString = (s: string) => new Date(s) > new Date();

export const assignmentSchema = z.object({
  group_id: z.string().min(1, 'Group is required'),
  class_id: z.string().optional(),
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  question: z.string().min(2, 'Question is required'),
  description: z.string().optional(),
  instructions: z.string().optional(),
  upload_open_at: z.string().min(1, 'Open time is required').refine(isFutureString, 'Must be a future date/time'),
  deadline_at: z.string().min(1, 'Deadline is required'),
  late_policy: z.enum(['STRICT', 'LATE_ALLOWED', 'ADMIN_ONLY']),
  reminder_offsets: z.array(z.number().int().positive()).min(1, 'At least one reminder offset is required'),
}).refine(d => d.deadline_at > d.upload_open_at, {
  path: ['deadline_at'],
  message: 'Deadline must be after upload open time',
});

export type AssignmentFormValues = z.infer<typeof assignmentSchema>;
