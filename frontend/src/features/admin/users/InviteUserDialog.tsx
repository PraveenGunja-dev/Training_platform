import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { usersApi } from '@/api/users';
import { groupsApi } from '@/api/groups';
import { apiClient } from '@/lib/api-client';
import { inviteSchema, type InviteFormValues } from './userSchema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ApiEnvelope, ClassGroup } from '@/lib/types';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteUserDialog({ open, onClose }: InviteUserDialogProps) {
  const qc = useQueryClient();

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiClient.get<ApiEnvelope<ClassGroup[]>>('/groups').then(r => r.data),
    enabled: open,
  });
  const groups = groupsData?.data ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'PARTICIPANT', group_ids: [] },
  });

  const selectedGroupIds = watch('group_ids') ?? [];
  const selectedRole = watch('role');
  const emailValue = watch('email');
  const debouncedEmail = useDebounce(emailValue, 500);

  const { data: emailCheckData } = useQuery({
    queryKey: ['users', 'check-email', debouncedEmail],
    queryFn: () => usersApi.checkEmailExists(debouncedEmail),
    enabled: !!debouncedEmail && /\S+@\S+\.\S+/.test(debouncedEmail),
    staleTime: 30_000,
    retry: false,
  });

  const emailAlreadyExists = emailCheckData?.data?.exists === true;

  const toggleGroup = (id: string) => {
    const current = selectedGroupIds;
    setValue(
      'group_ids',
      current.includes(id) ? current.filter(g => g !== id) : [...current, id],
    );
  };

  const onSubmit = async (values: InviteFormValues) => {
    let result: Awaited<ReturnType<typeof usersApi.invite>>;
    try {
      result = await usersApi.invite({ ...values });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: { message?: string; detail?: string }[]; detail?: string } } };
      const firstError = e?.response?.data?.errors?.[0];
      const msg = firstError?.message ?? firstError?.detail ?? e?.response?.data?.detail ?? 'Failed to register user';
      toast.error(msg);
      return;
    }

    if (values.role === 'GROUP_ADMIN' && values.group_admin_group_id) {
      try {
        await groupsApi.assignGroupAdmin(values.group_admin_group_id, result.data.id);
      } catch {
        toast.warning(`User "${values.email}" was created but could not be assigned as Group Admin. Please assign manually from the Group page.`);
        await qc.invalidateQueries({ queryKey: ['users'] });
        reset();
        onClose();
        return;
      }
    }

    toast.success(`User registered: ${values.email} (default password: admin123)`);
    await qc.invalidateQueries({ queryKey: ['users'] });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email <span className="text-red-500">*</span></Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
            {emailAlreadyExists && (
              <p className="text-xs text-amber-600 mt-1">A user with this email already exists.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role <span className="text-red-500">*</span></Label>
            <Select
              defaultValue="PARTICIPANT"
              onValueChange={(v) => setValue('role', v as InviteFormValues['role'])}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Super Admin</SelectItem>
                <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                <SelectItem value="PARTICIPANT">Participant</SelectItem>
                <SelectItem value="GROUP_ADMIN">Group Admin</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-xs text-red-500">{errors.role.message}</p>
            )}
          </div>

          {selectedRole === 'GROUP_ADMIN' && (
            <div className="space-y-1.5">
              <Label htmlFor="invite-admin-group">
                Admin of Group <span className="text-red-500">*</span>
              </Label>
              <Select
                onValueChange={v => setValue('group_admin_group_id', v)}
              >
                <SelectTrigger id="invite-admin-group">
                  <SelectValue placeholder="Select a group…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.group_admin_group_id && (
                <p className="text-xs text-red-500">{errors.group_admin_group_id.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Full Name <span className="text-muted-foreground/70 text-xs">(optional)</span></Label>
            <Input
              id="invite-name"
              placeholder="Jane Doe"
              {...register('full_name')}
            />
          </div>

          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>Groups <span className="text-muted-foreground/70 text-xs">(optional)</span></Label>
              <div className="max-h-36 overflow-y-auto space-y-2 rounded border border-border p-3">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedGroupIds.includes(g.id)}
                      onCheckedChange={() => toggleGroup(g.id)}
                    />
                    <span className="text-sm">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || emailAlreadyExists}>
              {isSubmitting ? 'Registering…' : 'Register User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
