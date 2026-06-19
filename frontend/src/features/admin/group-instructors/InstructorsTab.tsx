import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Trash2, GraduationCap, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { groupsApi } from '@/api/groups';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/dates';
import type { GroupInstructor, User } from '@/lib/types';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  PARTICIPANT: 'Participant',
  GROUP_ADMIN: 'Group Admin',
};

// ---------------------------------------------------------------------------
// ConfirmParticipantsDialog — shown when selected users include participants
// ---------------------------------------------------------------------------

interface ConfirmParticipantsDialogProps {
  participants: User[];
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function ConfirmParticipantsDialog({ participants, onConfirm, onCancel, isPending }: ConfirmParticipantsDialogProps) {
  return (
    <Dialog open onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-left">Role Change Warning</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-2">
            <span className="block">
              The following {participants.length === 1 ? 'user is' : 'users are'} currently a{' '}
              <strong>Participant</strong>. Assigning them as instructors will:
            </span>
            <ul className="list-disc list-inside text-sm space-y-0.5 text-slate-600 bg-amber-50 rounded-lg p-3">
              {participants.map(p => (
                <li key={p.id} className="font-medium text-amber-800">{p.full_name} ({p.email})</li>
              ))}
            </ul>
            <ul className="list-disc list-inside text-sm space-y-1 text-slate-600">
              <li>Change their role from Participant to Instructor</li>
              <li>Remove access to participant features (assignments, submissions)</li>
              <li>Existing attendance records and submissions will be retained but inaccessible</li>
            </ul>
            <span className="block font-medium text-slate-700">
              Are you sure you want to proceed?
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Assigning...' : 'Yes, Proceed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AddInstructorsDialog
// ---------------------------------------------------------------------------

interface AddInstructorsDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  existingIds: string[];
}

function AddInstructorsDialog({ open, onClose, groupId, existingIds }: AddInstructorsDialogProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['users', 'all-search', debouncedQuery],
    queryFn: () => usersApi.list({ search: debouncedQuery || undefined, page_size: 50 }),
    enabled: open,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  const results = (data?.data ?? []).filter(u => !existingIds.includes(u.id) && u.is_active);

  const mutation = useMutation({
    mutationFn: async (users: User[]) => {
      await groupsApi.assignInstructors(groupId, users.map(u => u.id));
      const participants = users.filter(u => u.role === 'PARTICIPANT');
      await Promise.all(
        participants.map(u => usersApi.update(u.id, { role: 'INSTRUCTOR' }))
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', groupId] });
      toast.success(
        `${selected.length} instructor${selected.length !== 1 ? 's' : ''} assigned.`,
      );
      setSelected([]);
      setQuery('');
      setShowConfirm(false);
      onClose();
    },
    onError: () => toast.error('Failed to assign instructors.'),
  });

  function toggle(user: User) {
    setSelected(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user],
    );
  }

  function handleClose() {
    setSelected([]);
    setQuery('');
    setDebouncedQuery('');
    setShowConfirm(false);
    onClose();
  }

  function handleSubmit() {
    const participants = selected.filter(u => u.role === 'PARTICIPANT');
    if (participants.length > 0) {
      setShowConfirm(true);
    } else {
      mutation.mutate(selected);
    }
  }

  const selectedIds = new Set(selected.map(u => u.id));
  const participantsInSelection = selected.filter(u => u.role === 'PARTICIPANT');

  return (
    <>
      <Dialog open={open && !showConfirm} onOpenChange={v => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Instructors</DialogTitle>
            <DialogDescription>
              Search all users to find and assign instructors to this group.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              className="pl-8"
              placeholder="Search by name or email..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {isFetching && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground/60" />
            )}
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {results.length === 0 && !isFetching ? (
              <p className="text-sm text-muted-foreground/70 p-4 text-center">
                {query ? 'No matching users found.' : 'No available users.'}
              </p>
            ) : (
              results.map(user => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary shrink-0"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggle(user)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                      <Badge
                        variant={user.role === 'PARTICIPANT' ? 'secondary' : user.role === 'INSTRUCTOR' ? 'teal' : 'info'}
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {ROLE_LABEL[user.role] ?? user.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {selected.length} user{selected.length !== 1 ? 's' : ''} selected:{' '}
                {selected.map(u => u.full_name).join(', ')}
              </p>
              {participantsInSelection.length > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {participantsInSelection.length} participant{participantsInSelection.length !== 1 ? 's' : ''} will have their role changed
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={selected.length === 0 || mutation.isPending}
            >
              {mutation.isPending
                ? 'Assigning...'
                : `Add${selected.length > 0 ? ` ${selected.length}` : ''} Selected`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showConfirm && (
        <ConfirmParticipantsDialog
          participants={participantsInSelection}
          onConfirm={() => mutation.mutate(selected)}
          onCancel={() => setShowConfirm(false)}
          isPending={mutation.isPending}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RemoveConfirmDialog
// ---------------------------------------------------------------------------

interface RemoveConfirmDialogProps {
  open: boolean;
  instructorName: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

function RemoveConfirmDialog({
  open,
  instructorName,
  onConfirm,
  onClose,
  isPending,
}: RemoveConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove Instructor</DialogTitle>
          <DialogDescription>
            Remove <strong>{instructorName}</strong> from this group? They will lose access to
            all group resources.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// InstructorsTab (exported)
// ---------------------------------------------------------------------------

export interface InstructorsTabProps {
  groupId: string;
}

export function InstructorsTab({ groupId }: InstructorsTabProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GroupInstructor | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['group-instructors', groupId],
    queryFn: () => groupsApi.getInstructors(groupId),
  });

  const instructors: GroupInstructor[] = data?.data ?? [];

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.unassignInstructor(groupId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', groupId] });
      toast.success('Instructor removed.');
      setRemoveTarget(null);
    },
    onError: () => toast.error('Failed to remove instructor.'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Instructors</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {instructors.length} instructor{instructors.length !== 1 ? 's' : ''} assigned
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Add Instructors
            </Button>
          )}
        </div>

        {instructors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No instructors assigned. Admins are running this group.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Assigned</TableHead>
                {isAdmin && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.map(inst => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/admin/users/${inst.id}`}
                      className="hover:underline text-primary"
                    >
                      {inst.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inst.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(inst.assigned_at, 'dd MMM yyyy')}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRemoveTarget(inst)}
                        aria-label={`Remove ${inst.full_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {isAdmin && (
        <AddInstructorsDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          groupId={groupId}
          existingIds={instructors.map(i => i.id)}
        />
      )}

      <RemoveConfirmDialog
        open={!!removeTarget}
        instructorName={removeTarget?.full_name ?? ''}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        onClose={() => setRemoveTarget(null)}
        isPending={removeMutation.isPending}
      />
    </div>
  );
}
