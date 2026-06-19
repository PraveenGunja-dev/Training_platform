import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { groupsApi } from '@/api/groups';
import { useAuthStore } from '@/store/auth';
import type { SubGroup } from '@/lib/types';

// ─── CreateSubGroupDialog ───────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupParticipants: Array<{ id: string; full_name: string; email: string }>;
}

function CreateSubGroupDialog({ open, onClose, groupId, groupParticipants }: CreateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nameError, setNameError] = useState('');

  const filtered = groupParticipants.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  function toggleParticipant(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map(p => p.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  const mutation = useMutation({
    mutationFn: () => groupsApi.createSubGroup(groupId, {
      name: name.trim(),
      user_ids: Array.from(selectedIds),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sub-groups', groupId] });
      toast.success('Sub-group created.');
      handleClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Failed to create sub-group.');
    },
  });

  function handleClose() {
    setName('');
    setSearch('');
    setSelectedIds(new Set());
    setNameError('');
    onClose();
  }

  function handleSubmit() {
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    setNameError('');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sub-Group</DialogTitle>
          <DialogDescription>
            Select participants from this group to form a sub-batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Sub-Group Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Batch A, Morning Shift..."
            />
            {nameError && <p className="text-xs text-rose-600">{nameError}</p>}
          </div>

          {/* Participant selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Participants
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-violet-600">
                    {selectedIds.size} selected
                  </span>
                )}
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[#0052A5] hover:underline"
                >
                  Select all
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search participants..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No participants found.</p>
              ) : (
                filtered.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleParticipant(p.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">{p.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {mutation.isPending ? 'Creating…' : 'Create Sub-Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DeleteConfirmDialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  subGroup: SubGroup | null;
  groupId: string;
  onClose: () => void;
}

function DeleteSubGroupDialog({ subGroup, groupId, onClose }: DeleteDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => groupsApi.deleteSubGroup(groupId, subGroup!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sub-groups', groupId] });
      toast.success(`"${subGroup!.name}" deleted.`);
      onClose();
    },
    onError: () => toast.error('Failed to delete sub-group.'),
  });

  return (
    <Dialog open={!!subGroup} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Sub-Group</DialogTitle>
          <DialogDescription>
            Delete <span className="font-semibold">"{subGroup?.name}"</span>?
            Participants remain in the parent group. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SubGroupCard ───────────────────────────────────────────────────────────

function SubGroupCard({
  subGroup,
  groupId,
  isAdmin,
  onDelete,
}: {
  subGroup: SubGroup;
  groupId: string;
  isAdmin: boolean;
  onDelete: (sg: SubGroup) => void;
}) {
  const MAX_SHOWN = 5;
  const shown = subGroup.participants.slice(0, MAX_SHOWN);
  const overflow = subGroup.participants_count - MAX_SHOWN;

  return (
    <Link
      to={`/admin/groups/${groupId}/sub-groups/${subGroup.id}`}
      className="block bg-white rounded-xl border border-violet-100 shadow-sm overflow-hidden hover:border-violet-300 hover:shadow-md transition-all"
    >
      <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800">{subGroup.name}</p>
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
              {subGroup.participants_count} member{subGroup.participants_count !== 1 ? 's' : ''}
            </Badge>
          </div>
          {isAdmin && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(subGroup); }}
              className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete sub-group"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {subGroup.participants_count > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {shown.map(p => (
              <span
                key={p.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600"
              >
                {p.full_name}
              </span>
            ))}
            {overflow > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-600">
                +{overflow} more
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No participants assigned.</p>
        )}

        <p className="mt-3 text-xs text-violet-400 font-medium">View details →</p>
      </div>
    </Link>
  );
}

// ─── SubGroupsTab (main export) ─────────────────────────────────────────────

interface Props {
  groupId: string;
  groupParticipants: Array<{ id: string; full_name: string; email: string }>;
}

export function SubGroupsTab({ groupId, groupParticipants }: Props) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubGroup | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sub-groups', groupId],
    queryFn: () => groupsApi.listSubGroups(groupId),
    staleTime: 30_000,
  });

  const subGroups = data?.data ?? [];

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Sub-Groups</h3>
          <p className="text-xs text-slate-500">Organize participants into named batches.</p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Sub-Group
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : subGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-violet-100 bg-violet-50/40">
          <Users className="h-8 w-8 text-violet-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No sub-groups yet</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin
              ? 'Create a sub-group to organize participants into batches.'
              : 'No sub-groups have been created for this group.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subGroups.map(sg => (
            <SubGroupCard
              key={sg.id}
              subGroup={sg}
              groupId={groupId}
              isAdmin={isAdmin}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateSubGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        groupId={groupId}
        groupParticipants={groupParticipants}
      />
      <DeleteSubGroupDialog
        subGroup={deleteTarget}
        groupId={groupId}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
