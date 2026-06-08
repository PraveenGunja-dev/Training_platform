import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Eye, GraduationCap, Building2,
  Hash, Briefcase, BarChart3, Clock, CalendarDays,
  ShieldCheck, UserCircle, Edit2, X, Save, CheckCircle2,
  AlertCircle, Ban,
} from 'lucide-react';
import { usersApi } from '@/api/users';
import { auditApi } from '@/api/audit';
import { formatDate, formatRelative } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AuditTable } from '@/features/admin/audit/AuditTable';
import type { Role } from '@/lib/types';

const ROLE_CONFIG: Record<Role, {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'secondary';
  gradient: string;
  icon: React.ReactNode;
}> = {
  ADMIN: {
    label: 'Super Admin',
    variant: 'info',
    gradient: 'linear-gradient(135deg, #001f4d 0%, #0052A5 100%)',
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  INSTRUCTOR: {
    label: 'Instructor',
    variant: 'warning',
    gradient: 'linear-gradient(135deg, #0052A5 0%, #C41230 100%)',
    icon: <GraduationCap className="h-3 w-3" />,
  },
  PARTICIPANT: {
    label: 'Participant',
    variant: 'success',
    gradient: 'linear-gradient(135deg, #0D7E5B 0%, #059669 100%)',
    icon: <UserCircle className="h-3 w-3" />,
  },
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('PARTICIPANT');

  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(id!),
    enabled: !!id,
  });
  const user = userData?.data;

  const { data: auditData } = useQuery({
    queryKey: ['audit', { actor_id: id }],
    queryFn: () => auditApi.list({ actor_id: id!, limit: 10 }),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { full_name?: string; role?: Role }) =>
      usersApi.update(id!, body),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['user', id] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'org-chart'] });
      setEditing(false);
    },
    onError: () => toast.error('Update failed'),
  });

  const startEdit = () => {
    if (!user) return;
    setFullName(user.full_name);
    setRole(user.role);
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({ full_name: fullName, role });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">User not found.</p>
        <Link to="/admin/users" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Users
        </Link>
      </div>
    );
  }

  const rc = ROLE_CONFIG[user.role];
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email[0].toUpperCase();

  const statusBadge = !user.is_active
    ? { icon: <Ban className="h-3 w-3" />, label: 'Blocked', cls: 'bg-red-50 border-red-200 text-red-700' }
    : user.must_change_password
    ? { icon: <AlertCircle className="h-3 w-3" />, label: 'Pending Setup', cls: 'bg-amber-50 border-amber-200 text-amber-700' }
    : { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Active', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' };

  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-[#5A7A9A] hover:text-[#0052A5] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      {/* ── Hero Profile Card ───────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-card-md border border-[#C5D8EC]">
        {/* Banner */}
        <div
          className="h-24 relative"
          style={{ background: rc.gradient }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute top-2 right-20 w-16 h-16 rounded-full bg-white/5" />
          <div className="absolute -bottom-3 left-10 w-20 h-20 rounded-full bg-white/5" />

          {/* Edit button top-right */}
          {!editing && (
            <div className="absolute top-3 right-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={startEdit}
                className="h-8 gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-medium backdrop-blur-sm"
              >
                <Edit2 className="h-3 w-3" />
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* Profile body */}
        <div className="bg-white px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <Avatar
              className="h-20 w-20 border-4 border-white shadow-lg flex-shrink-0"
            >
              <AvatarImage src={user.photo_url ?? undefined} />
              <AvatarFallback
                className="text-2xl font-bold text-white"
                style={{ background: rc.gradient }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Badges shown next to avatar on right edge */}
            <div className="pb-1 flex flex-wrap gap-2 items-center">
              <span
                className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: rc.gradient }}
              >
                {rc.icon}
                {rc.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${statusBadge.cls}`}>
                {statusBadge.icon}
                {statusBadge.label}
              </span>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#5A7A9A] uppercase tracking-wide">Full Name</Label>
                <Input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="border-[#C5D8EC] focus:border-[#0052A5] focus:ring-[#0052A5]/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#5A7A9A] uppercase tracking-wide">Role</Label>
                <Select value={role} onValueChange={v => setRole(v as Role)}>
                  <SelectTrigger className="border-[#C5D8EC]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Super Admin</SelectItem>
                    <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                    <SelectItem value="PARTICIPANT">Participant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                  className="gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #0052A5 0%, #003F8A 100%)' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-1.5 border-[#C5D8EC]">
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-[#00285A] leading-tight tracking-tight">
                {user.full_name || <span className="text-slate-400 italic font-normal text-lg">No name set</span>}
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-[#5A7A9A] mt-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </p>
            </div>
          )}

          {/* Meta info row */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#EBF3FB]">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CalendarDays className="h-3.5 w-3.5 text-[#0052A5]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#5A7A9A] uppercase tracking-wider">Joined</p>
                <p className="text-sm font-semibold text-[#00285A]">{formatDate(user.created_at, 'dd MMM yyyy')}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="h-3.5 w-3.5 text-[#0052A5]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#5A7A9A] uppercase tracking-wider">Last Login</p>
                <p className="text-sm font-semibold text-[#00285A]">
                  {user.last_login ? formatRelative(user.last_login) : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Hash className="h-3.5 w-3.5 text-[#0052A5]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#5A7A9A] uppercase tracking-wider">User ID</p>
                <p className="font-mono text-[11px] text-slate-400 truncate" title={user.id}>{user.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Details ────────────────────────────────────────────── */}
      {(user.employee_code || user.business_unit || user.grade_code || user.department) && (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-[#C5D8EC] bg-white">
          {/* Card header accent */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EBF3FB]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0052A5, #003F8A)' }}>
              <UserCircle className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-[#00285A] tracking-tight">Profile Details</h2>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-[#EBF3FB]">
            <ProfileField
              icon={<Hash className="h-3.5 w-3.5 text-[#0052A5]" />}
              label="Employee Code"
              value={user.employee_code}
            />
            <ProfileField
              icon={<Building2 className="h-3.5 w-3.5 text-[#0052A5]" />}
              label="Business Unit"
              value={user.business_unit}
            />
            <ProfileField
              icon={<BarChart3 className="h-3.5 w-3.5 text-[#0052A5]" />}
              label="Grade Code"
              value={user.grade_code}
            />
            <ProfileField
              icon={<Briefcase className="h-3.5 w-3.5 text-[#0052A5]" />}
              label="Department"
              value={user.department}
            />
          </div>
        </div>
      )}

      {/* ── Instructor Calendar Visibility ─────────────────────────────── */}
      {user.role === 'INSTRUCTOR' && (
        <InstructorVisibilityCard userId={user.id} currentValue={user.can_view_all_classes ?? null} />
      )}

      {/* ── Recent Activity ────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-[#C5D8EC] bg-white">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EBF3FB]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0052A5, #003F8A)' }}>
            <Clock className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-sm font-bold text-[#00285A] tracking-tight">Recent Activity</h2>
        </div>
        <div>
          <AuditTable entries={auditData?.data ?? []} />
        </div>
      </div>

    </div>
  );
}

/* ── ProfileField helper ──────────────────────────────────────────────── */
function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-[#5A7A9A] uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-[#00285A] mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstructorVisibilityCard
// ---------------------------------------------------------------------------

type VisibilityOption = 'inherit' | 'all' | 'own';

function visibilityToOption(val: boolean | null | undefined): VisibilityOption {
  if (val === true) return 'all';
  if (val === false) return 'own';
  return 'inherit';
}

function optionToValue(opt: VisibilityOption): boolean | null {
  if (opt === 'all') return true;
  if (opt === 'own') return false;
  return null;
}

const VISIBILITY_OPTIONS = [
  {
    value: 'inherit' as const,
    label: 'Inherit system default',
    description: 'Follows the global setting in System Settings',
  },
  {
    value: 'all' as const,
    label: 'Can view all classes',
    description: 'Sees every scheduled class across all groups',
  },
  {
    value: 'own' as const,
    label: 'Only own assigned classes',
    description: 'Restricted to classes in their assigned groups',
  },
];

function InstructorVisibilityCard({
  userId,
  currentValue,
}: {
  userId: string;
  currentValue: boolean | null;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<VisibilityOption>(
    visibilityToOption(currentValue),
  );

  const mutation = useMutation({
    mutationFn: (opt: VisibilityOption) =>
      usersApi.setVisibility(userId, optionToValue(opt)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user', userId] });
      toast.success('Calendar visibility updated.');
    },
    onError: () => toast.error('Failed to update visibility.'),
  });

  function handleChange(opt: VisibilityOption) {
    setSelected(opt);
    mutation.mutate(opt);
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-[#C5D8EC] bg-white">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0052A5, #003F8A)' }}>
          <Eye className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#00285A] tracking-tight">Calendar Visibility</h2>
          <p className="text-[11px] text-[#5A7A9A]">Controls which classes this instructor can see in the calendar</p>
        </div>
      </div>

      <div className="p-5 space-y-2.5">
        {VISIBILITY_OPTIONS.map(opt => {
          const isActive = selected === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                isActive
                  ? 'border-[#0052A5] bg-[#EBF3FB]'
                  : 'border-[#E2EDF6] bg-white hover:border-[#B3D1EE] hover:bg-[#F5F9FD]'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isActive ? 'border-[#0052A5] bg-[#0052A5]' : 'border-slate-300 bg-white'
                  }`}
                >
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isActive ? 'text-[#0052A5]' : 'text-[#00285A]'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-[#5A7A9A] mt-0.5">{opt.description}</p>
              </div>
              <input
                type="radio"
                name="instructor-visibility"
                value={opt.value}
                checked={isActive}
                onChange={() => handleChange(opt.value)}
                disabled={mutation.isPending}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>

      <div className="px-5 pb-4">
        <Link
          to="/admin/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0052A5] hover:text-[#003F8A] hover:underline transition-colors"
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Manage assigned groups
        </Link>
      </div>
    </div>
  );
}
