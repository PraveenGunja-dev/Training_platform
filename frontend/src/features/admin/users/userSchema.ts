import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['ADMIN', 'SUB_MENTOR', 'PARTICIPANT', 'LEAD_MENTOR']),
  full_name: z.string().optional(),
  group_ids: z.array(z.string()).optional(),
  lead_mentor_group_id: z.string().optional(),
}).refine(
  data => data.role !== 'LEAD_MENTOR' || !!data.lead_mentor_group_id,
  { message: 'Please select a group for the Group Admin', path: ['lead_mentor_group_id'] },
);

export type InviteFormValues = z.infer<typeof inviteSchema>;
