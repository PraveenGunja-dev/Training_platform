import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['ADMIN', 'INSTRUCTOR', 'PARTICIPANT']),
  full_name: z.string().optional(),
  group_ids: z.array(z.string()).optional(),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;
