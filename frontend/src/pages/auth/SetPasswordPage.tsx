import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { setPasswordSchema, type SetPasswordInput } from '@/features/auth/schemas';
import { useSetPassword } from '@/features/auth/useSetPassword';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function SetPasswordPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { mutate, isPending } = useSetPassword();

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose a strong password to activate your account.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(d => mutate({ token, password: d.password }))}
            className="space-y-4"
            noValidate
          >
            <div>
              <Label htmlFor="sp-password">New Password</Label>
              <Input
                id="sp-password"
                type="password"
                autoComplete="new-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-rose-600 mt-1" role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-1">
                At least 8 chars, 1 capital letter, 1 digit
              </p>
            </div>
            <div>
              <Label htmlFor="sp-confirm">Confirm Password</Label>
              <Input
                id="sp-confirm"
                type="password"
                autoComplete="new-password"
                {...form.register('confirm')}
              />
              {form.formState.errors.confirm && (
                <p className="text-xs text-rose-600 mt-1" role="alert">
                  {form.formState.errors.confirm.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Setting password…' : 'Set Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
