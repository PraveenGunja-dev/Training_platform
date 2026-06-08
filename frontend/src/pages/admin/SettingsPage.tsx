import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings, RefreshCw, Mail, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { settingsApi } from '@/api/settings';
import { useSettingsStore } from '@/store/settings';
import { SettingsForm } from '@/features/admin/settings/SettingsForm';
import { SettingsPreviewSidebar } from '@/features/admin/settings/SettingsPreviewSidebar';
import type { SettingsFormValues } from '@/features/admin/settings/settingsSchema';
import type { SystemSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth';
import { useChangeEmail } from '@/features/auth/useUpdateProfile';

function EmailChangeCard() {
  const user = useAuthStore(s => s.user);
  const changeEmail = useChangeEmail();

  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!currentEmail.trim()) errs.currentEmail = 'Current email is required.';
    if (!newEmail.trim()) {
      errs.newEmail = 'New email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      errs.newEmail = 'Enter a valid email address.';
    }
    if (!password) errs.password = 'Password is required.';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    changeEmail.mutate(
      { current_email: currentEmail.trim().toLowerCase(), new_email: newEmail.trim().toLowerCase(), current_password: password },
      { onSuccess: () => { setCurrentEmail(''); setNewEmail(''); setPassword(''); } },
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

      {/* Header — matches SectionCard style from SettingsForm */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
          <Mail className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Change Account Email</h3>
          <p className="text-xs text-slate-500">Update the email address used to sign in to this account.</p>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Active email display */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <Mail className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-0.5">Active Email</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email fields side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ce-current">Confirm Current Email</Label>
              <Input
                id="ce-current"
                type="email"
                autoComplete="email"
                placeholder="Your current email"
                value={currentEmail}
                onChange={e => setCurrentEmail(e.target.value)}
                className={fieldErrors.currentEmail ? 'border-red-400 focus-visible:ring-red-300' : ''}
              />
              {fieldErrors.currentEmail && <p className="text-xs text-red-500">{fieldErrors.currentEmail}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ce-new">New Email Address</Label>
              <Input
                id="ce-new"
                type="email"
                autoComplete="off"
                placeholder="New email address"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className={fieldErrors.newEmail ? 'border-red-400 focus-visible:ring-red-300' : ''}
              />
              {fieldErrors.newEmail && <p className="text-xs text-red-500">{fieldErrors.newEmail}</p>}
            </div>
          </div>

          {/* Password + submit on same row */}
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Label htmlFor="ce-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="ce-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password to confirm"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={fieldErrors.password ? 'border-red-400 focus-visible:ring-red-300 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
            </div>

            <Button type="submit" disabled={changeEmail.isPending} className="shrink-0">
              {changeEmail.isPending ? 'Updating…' : 'Update Email'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const qc          = useQueryClient();
  const setSettings = useSettingsStore(s => s.setSettings);
  const [lastSaved, setLastSaved]   = useState<Date | null>(null);
  const [liveValues, setLiveValues] = useState<SettingsFormValues | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      setSettings(res.data);
      return res;
    },
    staleTime: 0,
  });

  const updateMutation = useMutation({
    mutationFn: (values: SettingsFormValues) => settingsApi.update(values),
    onSuccess: (res) => {
      setSettings(res.data as SystemSettings);
      qc.setQueryData(['admin-settings'], res);
      setLastSaved(new Date());
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: () => settingsApi.forceLogout(),
    onSuccess: (res) => {
      toast.success(
        `Signed out ${res.data.cleared} active session${res.data.cleared === 1 ? '' : 's'}.`
      );
    },
    onError: () => toast.error('Force logout failed'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-slate-500">Failed to load settings.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  const sidebarValues = liveValues ?? (data.data as SettingsFormValues);

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 flex-shrink-0">
          <Settings className="h-5 w-5 text-[#E31837]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">System Settings</h1>
          <p className="text-sm text-slate-500">Configure system-wide defaults and limits.</p>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">

        {/* Left — system settings form + account email card stacked */}
        <div className="space-y-5">
          <SettingsForm
            initialValues={data.data}
            onSubmit={async (values: SettingsFormValues) => {
              await updateMutation.mutateAsync(values);
            }}
            onForceLogout={async () => {
              await forceLogoutMutation.mutateAsync();
            }}
            onValuesChange={setLiveValues}
            saving={updateMutation.isPending}
            loggingOut={forceLogoutMutation.isPending}
          />
          <EmailChangeCard />
        </div>

        {/* Right — sticky preview sidebar */}
        <div className="xl:sticky xl:top-6">
          <SettingsPreviewSidebar
            values={sidebarValues}
            lastSaved={lastSaved}
            saving={updateMutation.isPending}
          />
        </div>

      </div>

    </div>
  );
}
