import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, FolderKanban, Archive, Trash2,
  GraduationCap, UserPlus, X, Search, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { groupsApi } from '@/api/groups';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/auth';
import type { GroupDetail, GroupInstructor, User } from '@/lib/types';

// ── Add Instructors dialog ────────────────────────────────────────────────────

function AddInstructorsDialog({
  open, onClose, groupId, existingIds,
}: {
  open: boolean; onClose: () => void; groupId: string; existingIds: string[];
}) {
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
    mutationFn: (users: User[]) => groupsApi.assignInstructors(groupId, users.map(u => u.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'org-chart'] });
      toast.success(`${selected.length} instructor${selected.length !== 1 ? 's' : ''} assigned.`);
      setSelected([]); setQuery(''); onClose();
    },
    onError: () => toast.error('Failed to assign instructors.'),
  });

  function toggle(u: User) {
    setSelected(prev => prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);
  }

  function handleClose() { setSelected([]); setQuery(''); onClose(); }

  const selectedIds = new Set(selected.map(u => u.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Instructors</DialogTitle>
          <DialogDescription>Search by name or email to assign instructors to this group.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input className="pl-8" placeholder="Search by name or email..." value={query}
            onChange={e => setQuery(e.target.value)} autoFocus />
          {isFetching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground/60" />}
        </div>

        <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
          {results.length === 0 && !isFetching ? (
            <p className="text-sm text-muted-foreground/70 p-4 text-center">
              {query ? 'No matching instructors found.' : 'No available instructors.'}
            </p>
          ) : results.map(u => (
            <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" className="h-4 w-4 accent-primary shrink-0"
                checked={selectedIds.has(u.id)} onChange={() => toggle(u)} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
            </label>
          ))}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selected.length} selected: {selected.map(u => u.full_name).join(', ')}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(selected)} disabled={selected.length === 0 || mutation.isPending}>
            {mutation.isPending ? 'Assigning...' : `Add${selected.length > 0 ? ` ${selected.length}` : ''} Selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Remove confirm dialog ─────────────────────────────────────────────────────

function RemoveConfirmDialog({
  open, name, onConfirm, onClose, isPending,
}: {
  open: boolean; name: string; onConfirm: () => void; onClose: () => void; isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove Instructor</DialogTitle>
          <DialogDescription>
            Remove <strong>{name}</strong> from this group? They will lose access to all group resources.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── GroupHeader ───────────────────────────────────────────────────────────────

export function GroupHeader({
  group,
  onDeleteClick,
}: {
  group: GroupDetail;
  onDeleteClick?: () => void;
}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GroupInstructor | null>(null);

  const { data: instData } = useQuery({
    queryKey: ['group-instructors', group.id],
    queryFn: () => groupsApi.getInstructors(group.id),
    staleTime: 30_000,
  });
  const instructors: GroupInstructor[] = instData?.data ?? [];

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.unassignInstructor(group.id, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'org-chart'] });
      toast.success('Instructor removed.');
      setRemoveTarget(null);
    },
    onError: () => toast.error('Failed to remove instructor.'),
  });

  return (
    <>
      <div className="bg-white rounded-xl border border-[#D6E8F8] overflow-hidden shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #EBF3FB 0%, #fce8eb 100%)', border: '1px solid #D6E8F8' }}
            >
              <FolderKanban className="h-6 w-6 text-[#0052A5]" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[#00285A]">{group.name}</h1>
                {group.is_archived && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200">
                    <Archive className="h-3 w-3" />
                    Archived
                  </Badge>
                )}
              </div>

              {group.description && (
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{group.description}</p>
              )}

              {/* Participants chip */}
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052A5] bg-[#EBF3FB] border border-[#D6E8F8] px-2.5 py-1 rounded-full">
                  <Users className="h-3.5 w-3.5" />
                  {group.participants_count} Participants
                </span>
              </div>

              {/* Instructors row */}
              {(instructors.length > 0 || isAdmin) && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Instructors:
                  </span>

                  {instructors.map(inst => (
                    <span
                      key={inst.id}
                      className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg shadow-sm"
                    >
                      <GraduationCap className="h-4 w-4 shrink-0 text-emerald-600" />
                      <Link to={`/admin/users/${inst.id}`} className="hover:underline leading-none">
                        {inst.full_name}
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => setRemoveTarget(inst)}
                          className="rounded-full hover:bg-emerald-300 p-0.5 transition-colors text-emerald-600"
                          aria-label={`Remove ${inst.full_name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}

                  {instructors.length === 0 && !isAdmin && (
                    <span className="text-sm text-slate-400 italic">None assigned</span>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => setAddOpen(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0052A5] bg-white border border-dashed border-[#A8C8E8] px-3 py-1.5 rounded-lg hover:border-[#0052A5] hover:bg-[#EBF3FB] transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Instructor
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {onDeleteClick && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
              onClick={onDeleteClick}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Group
            </Button>
          )}
        </div>
      </div>

      {isAdmin && (
        <AddInstructorsDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          groupId={group.id}
          existingIds={instructors.map(i => i.id)}
        />
      )}

      <RemoveConfirmDialog
        open={!!removeTarget}
        name={removeTarget?.full_name ?? ''}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        onClose={() => setRemoveTarget(null)}
        isPending={removeMutation.isPending}
      />
    </>
  );
}
