import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordStrength = z
  .string()
  .min(8, 'At least 8 characters required')
  .regex(/[A-Z]/, 'Must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Must contain at least 1 digit');

export const setPasswordSchema = z.object({
  password: passwordStrength,
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z.object({
  current: z.string().min(1, 'Current password is required'),
  new_password: passwordStrength,
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, {
  path: ['confirm'],
  message: 'Passwords do not match',
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
