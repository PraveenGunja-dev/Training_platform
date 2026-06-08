import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Camera, Eye, EyeOff, Shield, User, Mail, Calendar,
  Clock, Hash, CheckCircle, KeyRound, Pencil, Check, X,
  Building2, Layers, Tag, Briefcase,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import {
  useUpdateProfile, useUploadPhoto, useChangePassword,
} from '@/features/auth/useUpdateProfile';
import { changePasswordSchema, type ChangePasswordInput } from '@/features/auth/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-rose-500' };
  if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Good', color: 'bg-emerald-400' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className={cn('text-sm font-medium text-slate-800 break-all', mono && 'font-mono text-xs')}>{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const nameSchema = z.object({ full_name: z.string().min(2, 'Name must be at least 2 characters') });
type NameInput = z.infer<typeof nameSchema>;

export function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const isInstructor = user?.role === 'INSTRUCTOR';

  // Photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const uploadPhoto = useUploadPhoto();

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const nameForm = useForm<NameInput>({
    resolver: zodResolver(nameSchema),
    defaultValues: { full_name: user?.full_name ?? '' },
  });
  const updateProfile = useUpdateProfile();

  // Password
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', new_password: '', confirm: '' },
  });
  const changePassword = useChangePassword();
  const watchedNew = passwordForm.watch('new_password');
  const strength = passwordStrength(watchedNew);

  useEffect(() => {
    if (user) nameForm.reset({ full_name: user.full_name });
  }, [user, nameForm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    uploadPhoto.mutate(file, {
      onError: () => setPreview(null),
    });
    e.target.value = '';
  };

  const handleNameSave = nameForm.handleSubmit(data => {
    updateProfile.mutate(data, { onSuccess: () => setEditingName(false) });
  });

  const accentGradient = isAdmin
    ? 'from-indigo-600 via-indigo-700 to-indigo-800'
    : isInstructor
      ? 'from-emerald-600 via-emerald-700 to-teal-800'
      : 'from-violet-600 via-purple-700 to-purple-800';

  const accentBg   = isAdmin ? 'bg-[#0052A5]' : isInstructor ? 'bg-emerald-600' : 'bg-[#E31837]';
  const accentText = isAdmin ? 'text-[#0052A5]' : isInstructor ? 'text-emerald-700' : 'text-[#E31837]';
  const accentBorder = isAdmin ? 'border-blue-200' : isInstructor ? 'border-emerald-200' : 'border-violet-200';
  const accentRing   = isAdmin ? 'ring-[#0052A5]' : isInstructor ? 'ring-emerald-500' : 'ring-violet-500';
  const roleLabel    = isAdmin ? 'Super Admin' : isInstructor ? 'Instructor' : 'Participant';

  const photoSrc = preview ?? user?.photo_url ?? undefined;
  const userInitials = user ? initials(user.full_name) : '?';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero banner ── */}
      <div className={cn('relative h-44 bg-gradient-to-br', accentGradient)}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {/* ── Profile header ── */}
        <div className="-mt-16 mb-8 flex flex-col sm:flex-row items-center sm:items-end gap-4">
          {/* Avatar with upload overlay */}
          <div className="relative group">
            <Avatar className={cn('h-32 w-32 border-4 border-white shadow-xl ring-2', accentRing)}>
              <AvatarImage src={photoSrc} alt={user?.full_name} className="object-cover" />
              <AvatarFallback className={cn('text-2xl font-bold text-white', accentBg)}>
                {userInitials}
              </AvatarFallback>
            </Avatar>

            {/* Upload overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhoto.isPending}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Change profile photo"
            >
              {uploadPhoto.isPending ? (
                <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name + badges */}
          <div className="sm:pb-2 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900">{user?.full_name}</h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5">
              <Badge className={cn(
                'text-xs font-semibold px-2.5',
                isAdmin
                  ? 'bg-blue-100 text-[#0052A5] border-blue-200'
                  : isInstructor
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-violet-100 text-violet-700 border-violet-200',
              )}>
                {roleLabel}
              </Badge>
              {user?.is_active && (
                <Badge className="text-xs font-semibold px-2.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Personal Information ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={cn('p-1.5 rounded-lg', isAdmin ? 'bg-blue-50' : 'bg-violet-50')}>
                <User className={cn('h-4 w-4', accentText)} />
              </div>
              <h2 className="font-semibold text-slate-800">Personal Information</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Full Name — inline edit */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Full Name</Label>
                {editingName ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      {...nameForm.register('full_name')}
                      className={cn('flex-1 h-9 text-sm', accentBorder)}
                      disabled={updateProfile.isPending}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={handleNameSave}
                      disabled={updateProfile.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => { setEditingName(false); nameForm.reset(); }}
                      disabled={updateProfile.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group/name">
                    <span className="text-sm font-medium text-slate-800">{user?.full_name}</span>
                    <button
                      onClick={() => setEditingName(true)}
                      className={cn(
                        'opacity-0 group-hover/name:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100',
                        accentText,
                      )}
                      aria-label="Edit name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {nameForm.formState.errors.full_name && (
                  <p className="text-xs text-rose-600">{nameForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <Separator />

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Email Address</Label>
                <div className="flex items-center gap-2 py-1">
                  <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{user?.email}</span>
                </div>
              </div>

              <Separator />

              {/* Photo upload hint */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Camera className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-600">Profile Photo</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={cn('text-xs font-medium underline', accentText)}
                    disabled={uploadPhoto.isPending}
                  >
                    {uploadPhoto.isPending ? 'Uploading…' : 'Click avatar to change photo'}
                  </button>
                  <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, WEBP or GIF · max 5 MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Account Details ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={cn('p-1.5 rounded-lg', isAdmin ? 'bg-blue-50' : 'bg-violet-50')}>
                <Shield className={cn('h-4 w-4', accentText)} />
              </div>
              <h2 className="font-semibold text-slate-800">Account Details</h2>
            </div>

            <div className="px-6 py-2 divide-y divide-slate-50">
              <InfoRow
                icon={Calendar}
                label="Member Since"
                value={user?.created_at ? format(new Date(user.created_at), 'MMMM d, yyyy') : '—'}
              />
              <InfoRow
                icon={Clock}
                label="Last Login"
                value={
                  user?.last_login
                    ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                    : 'Unknown'
                }
              />
              <InfoRow
                icon={CheckCircle}
                label="Account Status"
                value={user?.is_active ? 'Active' : 'Inactive'}
              />
              <InfoRow
                icon={Hash}
                label="User ID"
                value={user?.id ?? '—'}
                mono
              />
            </div>
          </div>
        </div>

        {/* ── Organisation Details (read-only, shown only when data exists) ── */}
        {(user?.business_unit || user?.department || user?.grade_code || user?.employee_code) && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={cn('p-1.5 rounded-lg', isAdmin ? 'bg-blue-50' : isInstructor ? 'bg-emerald-50' : 'bg-violet-50')}>
                <Building2 className={cn('h-4 w-4', accentText)} />
              </div>
              <h2 className="font-semibold text-slate-800">Organisation Details</h2>
              <span className="ml-auto text-xs text-slate-400">Read-only</span>
            </div>
            <div className="px-6 py-2 grid grid-cols-1 sm:grid-cols-2 divide-y divide-slate-50 sm:divide-y-0">
              {user?.business_unit  && <InfoRow icon={Building2} label="Business Unit" value={user.business_unit} />}
              {user?.department     && <InfoRow icon={Layers}    label="Department"    value={user.department} />}
              {user?.grade_code     && <InfoRow icon={Tag}       label="Grade Code"    value={user.grade_code} />}
              {user?.employee_code  && <InfoRow icon={Briefcase} label="Employee Code" value={user.employee_code} mono />}
            </div>
          </div>
        )}

        {/* ── Change Password ── */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className={cn('p-1.5 rounded-lg', isAdmin ? 'bg-blue-50' : 'bg-violet-50')}>
              <KeyRound className={cn('h-4 w-4', accentText)} />
            </div>
            <h2 className="font-semibold text-slate-800">Change Password</h2>
          </div>

          <div className="px-6 py-5">
            <form
              onSubmit={passwordForm.handleSubmit(d =>
                changePassword.mutate(
                  { current: d.current, new_password: d.new_password },
                  { onSuccess: () => passwordForm.reset() },
                )
              )}
              className="space-y-4"
              noValidate
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Current */}
                <div className="space-y-1.5">
                  <Label htmlFor="cp-current" className="text-xs text-slate-600">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="cp-current"
                      type={showCurrent ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="pr-9 text-sm"
                      {...passwordForm.register('current')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.current && (
                    <p className="text-xs text-rose-600">{passwordForm.formState.errors.current.message}</p>
                  )}
                </div>

                {/* New */}
                <div className="space-y-1.5">
                  <Label htmlFor="cp-new" className="text-xs text-slate-600">New Password</Label>
                  <div className="relative">
                    <Input
                      id="cp-new"
                      type={showNew ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="pr-9 text-sm"
                      {...passwordForm.register('new_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {watchedNew.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-colors',
                              i <= strength.score ? strength.color : 'bg-slate-200',
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">{strength.label}</p>
                    </div>
                  )}
                  {passwordForm.formState.errors.new_password && (
                    <p className="text-xs text-rose-600">{passwordForm.formState.errors.new_password.message}</p>
                  )}
                </div>

                {/* Confirm */}
                <div className="space-y-1.5">
                  <Label htmlFor="cp-confirm" className="text-xs text-slate-600">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="cp-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="pr-9 text-sm"
                      {...passwordForm.register('confirm')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.confirm && (
                    <p className="text-xs text-rose-600">{passwordForm.formState.errors.confirm.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={changePassword.isPending}
                  className="px-6"
                >
                  {changePassword.isPending ? 'Changing…' : 'Change Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
