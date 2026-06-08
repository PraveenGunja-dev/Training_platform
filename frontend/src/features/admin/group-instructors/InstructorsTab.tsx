import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Trash2, GraduationCap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [selected, setSelected] = useState<User[]>([]);

  const { data, isFetching } = useQuery({
    queryKey: ['instructors', 'search', query],
    queryFn: () => usersApi.listInstructors(query || undefined),
    enabled: open,
    staleTime: 10_000,
  });

  const results = (data?.data ?? []).filter(u => !existingIds.includes(u.id));

  const mutation = useMutation({
    mutationFn: (users: User[]) =>
      groupsApi.assignInstructors(groupId, users.map(u => u.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', groupId] });
      toast.success(
        `${selected.length} instructor${selected.length !== 1 ? 's' : ''} assigned.`,
      );
      setSelected([]);
      setQuery('');
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
    onClose();
  }

  const selectedIds = new Set(selected.map(u => u.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Instructors</DialogTitle>
          <DialogDescription>
            Search by name or email to find and assign instructors to this group.
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
              {query ? 'No matching instructors found.' : 'No available instructors.'}
            </p>
          ) : (
            results.map(user => (
              <label
                key={user.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary shrink-0"
                  checked={selectedIds.has(user.id)}
                  onChange={() => toggle(user)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </label>
            ))
          )}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selected.length} instructor{selected.length !== 1 ? 's' : ''} selected:{' '}
            {selected.map(u => u.full_name).join(', ')}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate(selected)}
            disabled={selected.length === 0 || mutation.isPending}
          >
            {mutation.isPending
              ? 'Assigning...'
              : `Add${selected.length > 0 ? ` ${selected.length}` : ''} Selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
