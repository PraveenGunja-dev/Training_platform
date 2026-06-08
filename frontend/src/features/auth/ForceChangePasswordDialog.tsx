import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, ShieldAlert, Eye, EyeOff, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useChangePassword } from './useUpdateProfile';
import { changePasswordSchema, type ChangePasswordInput } from './schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  error,
  registration,
}: {
  id: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  error?: string;
  registration: object;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-10"
          {...registration}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ForceChangePasswordDialog() {
  const user    = useAuthStore(s => s.user);
  const logout  = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const open = user?.must_change_password === true;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const mutation = useChangePassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = (values: ChangePasswordInput) => {
    mutation.mutate(
      { current: values.current, new_password: values.new_password },
      { onSuccess: () => reset() },
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        hideClose
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 shrink-0">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-left">Set Your Password</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Your account was created with a default password. You must set a new
            password before you can use the portal.
          </DialogDescription>
        </DialogHeader>

        {/* Default password info box */}
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p>Your default password is <span className="font-mono font-semibold">admin123</span>.</p>
            <p className="font-medium">Remember your new password — you will need it every time you log in.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <PasswordField
            id="fcp-current"
            label="Current Password"
            placeholder="Enter: admin123"
            autoComplete="current-password"
            error={errors.current?.message}
            registration={register('current')}
          />

          <PasswordField
            id="fcp-new"
            label="New Password"
            placeholder="Min 8 chars, 1 uppercase, 1 digit"
            autoComplete="new-password"
            error={errors.new_password?.message}
            registration={register('new_password')}
          />

          <PasswordField
            id="fcp-confirm"
            label="Confirm New Password"
            placeholder="Repeat new password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            registration={register('confirm')}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Set New Password'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full text-slate-600"
            onClick={handleLogout}
            disabled={mutation.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
