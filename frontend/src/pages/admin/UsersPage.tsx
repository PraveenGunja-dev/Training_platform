import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Users, Search, Ban, UserCheck, Trash2, ShieldCheck, User, AlertTriangle, Eye } from 'lucide-react';
import { usersApi } from '@/api/users';
import { formatDate, formatRelative } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { InviteUserDialog } from '@/features/admin/users/InviteUserDialog';
import { BulkInviteDialog } from '@/features/admin/users/BulkInviteDialog';
import { ErrorState } from '@/components/states/ErrorState';
import { cn, getFileUrl } from '@/lib/utils';
import type { Role } from '@/lib/types';

/* ── Role styling ────────────────────────────────────────────────────── */
const ROLE_CONFIG: Record<Role, {
  label: string;
  badgeVariant: 'success' | 'warning' | 'info' | 'secondary' | 'teal';
  avatarBg: string;
  avatarText: string;
  icon: typeof User;
}> = {
  ADMIN:       { label: 'Super Admin',  badgeVariant: 'info',      avatarBg: 'bg-blue-100',    avatarText: 'text-[#0052A5]',  icon: ShieldCheck },
  INSTRUCTOR:  { label: 'Instructor',   badgeVariant: 'warning',   avatarBg: 'bg-amber-100',   avatarText: 'text-amber-700',  icon: User        },
  PARTICIPANT: { label: 'Participant',  badgeVariant: 'success',   avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-700', icon: User       },
  GROUP_ADMIN: { label: 'Group Admin',  badgeVariant: 'teal',      avatarBg: 'bg-teal-100',    avatarText: 'text-teal-700',   icon: ShieldCheck },
};

/* ── Stat pill ───────────────────────────────────────────────────────── */
function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${color}`}>
      <span className="tabular-nums text-sm font-bold">{count}</span>
      <span>{label}</span>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch]               = useState('');
  const [roleFilter, setRoleFilter]       = useState('ALL');
  const [accessFilter, setAccessFilter]   = useState('ALL');
  const [setupFilter, setSetupFilter]     = useState('ALL');
  const [buFilter, setBuFilter]           = useState('ALL');
  const [page, setPage]                   = useState(1);
  const [showInvite, setShowInvite]   = useState(false);
  const [showBulk, setShowBulk]       = useState(false);

  /* User targeted for deletion — drives the confirmation dialog */
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', { search, role: roleFilter, access: accessFilter, setup: setupFilter, bu: buFilter, page }],
    queryFn: () =>
      usersApi.list({
        search:        search        || undefined,
        role:          roleFilter    !== 'ALL' ? roleFilter    : undefined,
        status:        accessFilter  !== 'ALL' ? accessFilter  : undefined,
        setup:         setupFilter   !== 'ALL' ? setupFilter   : undefined,
        business_unit: buFilter      !== 'ALL' ? buFilter      : undefined,
        page,
        page_size: 20,
      }),
    staleTime: 30_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['users-stats'],
    queryFn: () => usersApi.stats(),
    staleTime: 60_000,
  });

  const { data: buData } = useQuery({
    queryKey: ['users-business-units'],
    queryFn: () => usersApi.businessUnits(),
    staleTime: 5 * 60_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.update(id, { is_active: active }),
    onSuccess: (_, { active }) => {
      toast.success(active ? 'User reactivated' : 'User deactivated');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-stats'] });
    },
    onError: () => toast.error('Action failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('User deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-stats'] });
    },
    onError: () => {
      toast.error('Delete failed');
      setDeleteTarget(null);
    },
  });

  const users      = data?.data ?? [];
  const meta       = data?.meta as { page: number; page_size: number; total: number } | undefined;
  const totalPages = meta ? Math.ceil(meta.total / meta.page_size) : 1;
  const stats      = statsData?.data;

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
            <Users className="h-5 w-5 text-[#0052A5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Users</h1>
            <p className="text-sm text-slate-500">Manage all users in the system</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Users className="h-4 w-4 mr-1.5" />
            Bulk Invite (CSV)
          </Button>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Invite User
          </Button>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Total"        count={stats.total}        color="bg-slate-50 text-slate-600 border-slate-200"       />
          <StatPill label="Super Admins" count={stats.admins}       color="bg-blue-50 text-[#0052A5] border-blue-200"         />
          <StatPill label="Instructors"  count={stats.instructors}  color="bg-amber-50 text-amber-700 border-amber-200"       />
          <StatPill label="Participants" count={stats.participants} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <StatPill label="Group Admins" count={stats.group_admins} color="bg-purple-50 text-purple-700 border-purple-200"   />
          <StatPill label="Active"       count={stats.active}       color="bg-teal-50 text-teal-700 border-teal-200"          />
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email or employee code…"
            className="pl-8 w-60"
          />
        </div>

        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="ADMIN">Super Admin</SelectItem>
            <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
            <SelectItem value="PARTICIPANT">Participant</SelectItem>
            <SelectItem value="GROUP_ADMIN">Group Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select value={accessFilter} onValueChange={v => { setAccessFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Access" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Access</SelectItem>
            <SelectItem value="allowed">Allowed Access</SelectItem>
            <SelectItem value="blocked">Blocked Access</SelectItem>
          </SelectContent>
        </Select>

        <Select value={setupFilter} onValueChange={v => { setSetupFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Setup" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Setup</SelectItem>
            <SelectItem value="pending">Pending Setup</SelectItem>
            <SelectItem value="complete">Active</SelectItem>
          </SelectContent>
        </Select>

        <Select value={buFilter} onValueChange={v => { setBuFilter(v); setPage(1); }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Business Units" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Business Units</SelectItem>
            {(buData?.data ?? []).map(unit => (
              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Indigo accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-500">User List</p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true" aria-label="Loading users…">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load users" onRetry={() => void refetch()} />
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 bg-slate-50/40 hover:bg-slate-50/40">
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">User</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Role</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">Joined</TableHead>
                  <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">Last Login</TableHead>
                  <TableHead className="text-right text-slate-400 font-medium text-xs uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const rc = ROLE_CONFIG[user.role];
                  const initials = user.full_name
                    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : user.email[0].toUpperCase();
                  return (
                    <TableRow
                      key={user.id}
                      className={`border-slate-100 hover:bg-slate-50/50 ${!user.is_active ? 'opacity-55' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getFileUrl(user.photo_url) ?? undefined} />
                            <AvatarFallback className={`text-xs font-semibold ${rc.avatarBg} ${rc.avatarText}`}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {user.full_name || <span className="text-slate-400 italic font-normal">No name</span>}
                            </p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rc.badgeVariant}>{rc.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {!user.is_active ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : user.must_change_password ? (
                          <Badge variant="warning">Pending Setup</Badge>
                        ) : (
                          <Badge variant="teal">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(user.created_at, 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {user.last_login ? formatRelative(user.last_login) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" title="Actions">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/users/${user.id}`} className="flex items-center gap-2 cursor-pointer">
                                  <Eye className="h-3.5 w-3.5" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!user.is_active && (
                                <DropdownMenuItem
                                  className="flex items-center gap-2 cursor-pointer"
                                  onClick={() => deactivateMutation.mutate({ id: user.id, active: true })}
                                  disabled={deactivateMutation.isPending}
                                >
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  Enable Access
                                </DropdownMenuItem>
                              )}
                              {user.is_active && (
                                <DropdownMenuItem
                                  className="flex items-center gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                                  onClick={() => deactivateMutation.mutate({ id: user.id, active: false })}
                                  disabled={deactivateMutation.isPending}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Block Access
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-600"
                                onClick={() => setDeleteTarget({ id: user.id, label: user.full_name || user.email })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* ── Delete confirmation dialog ────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Delete User
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-slate-500 pl-[52px]">
              Are you sure you want to permanently delete{' '}
              <span className="font-medium text-slate-700">{deleteTarget?.label}</span>?
              This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteUserDialog open={showInvite} onClose={() => setShowInvite(false)} />
      <BulkInviteDialog open={showBulk}   onClose={() => setShowBulk(false)}   />
    </div>
  );
}
