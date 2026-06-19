import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['ADMIN', 'INSTRUCTOR', 'PARTICIPANT', 'GROUP_ADMIN']),
  full_name: z.string().optional(),
  group_ids: z.array(z.string()).optional(),
  group_admin_group_id: z.string().optional(),
}).refine(
  data => data.role !== 'GROUP_ADMIN' || !!data.group_admin_group_id,
  { message: 'Please select a group for the Group Admin', path: ['group_admin_group_id'] },
);

export type InviteFormValues = z.infer<typeof inviteSchema>;
