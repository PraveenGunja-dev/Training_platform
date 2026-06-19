import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Trash2, ChevronRight, Loader2, Users, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { groupsApi } from '@/api/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

// ── CreateSubGroupDialog ──────────────────────────────────────────────────────

type Participant = { id: string; full_name: string; email: string };

function CreateSubGroupDialog({
  open,
  onClose,
  groupId,
  participants,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  participants: Participant[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const createMutation = useMutation({
    mutationFn: () =>
      groupsApi.createSubGroup(groupId, {
        name: name.trim(),
        user_ids: Array.from(selectedIds),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sub-groups', groupId] });
      toast.success('Sub-group created.');
      handleClose();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? 'Failed to create sub-group.');
    },
  });

  function handleClose() {
    setName('');
    setSearch('');
    setSelectedIds(new Set());
    onClose();
  }

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const q = search.toLowerCase();
  const filtered = participants.filter(
    p => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sub-Group</DialogTitle>
          <DialogDescription>
            Give the sub-group a name and optionally add participants from your group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Sub-group name</Label>
            <Input
              id="sg-name"
              placeholder="e.g. Batch A"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Participant picker */}
          {participants.length > 0 && (
            <div className="space-y-1.5">
              <Label>Add participants <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="Search participants..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">No participants found.</p>
                ) : filtered.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleId(p.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <p className="text-xs text-teal-600">{selectedIds.size} participant{selectedIds.size !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating...</>
            ) : 'Create Sub-Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── SubGroupsPage ─────────────────────────────────────────────────────────────

type SubGroup = { id: string; name: string; participants_count: number };

function DeleteConfirmDialog({
  subGroup,
  onConfirm,
  onCancel,
  isPending,
}: {
  subGroup: SubGroup;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle className="text-left">Delete Sub-Group?</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Are you sure you want to delete <strong>{subGroup.name}</strong>?
            {subGroup.participants_count > 0 && (
              <span className="block mt-1 text-amber-600">
                {subGroup.participants_count} participant{subGroup.participants_count !== 1 ? 's' : ''} will be removed from this sub-group.
              </span>
            )}
            <span className="block mt-1">This action cannot be undone.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Deleting...</> : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GroupAdminSubGroupsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const groupIds = user?.admin_of_group_ids ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupIds[0] ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubGroup | null>(null);

  const { data: subGroupsData, isLoading } = useQuery({
    queryKey: ['sub-groups', selectedGroupId],
    queryFn: () => groupsApi.listSubGroups(selectedGroupId!),
    enabled: !!selectedGroupId,
    staleTime: 30_000,
  });

  const { data: groupData } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId!),
    enabled: !!selectedGroupId,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (subGroupId: string) => groupsApi.deleteSubGroup(selectedGroupId!, subGroupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sub-groups', selectedGroupId] });
      toast.success('Sub-group deleted.');
      setPendingDelete(null);
    },
    onError: () => toast.error('Failed to delete sub-group.'),
  });

  if (groupIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">You are not assigned as admin for any group.</p>
        <p className="text-xs mt-1 text-slate-400">Contact a Super Admin to get access.</p>
      </div>
    );
  }

  const subGroups = subGroupsData?.data ?? [];
  const participants = (groupData?.data?.participants ?? []) as Participant[];

  return (
    <div className="p-6 space-y-6">
      {groupIds.length > 1 && (
        <div className="mb-4">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groupIds.map(id => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100">
            <Layers className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Sub-Groups</h1>
            <p className="text-sm text-slate-500">
              {subGroups.length} sub-group{subGroups.length !== 1 ? 's' : ''} in your group
            </p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Sub-Group
        </Button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : subGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Layers className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No sub-groups created yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Sub-Group
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {subGroups.map(sg => (
              <div key={sg.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group">
                <Link
                  to={`/group-admin/sub-groups/${sg.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 shrink-0">
                    <Layers className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{sg.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Users className="h-3 w-3" />
                      {sg.participants_count} participant{sg.participants_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-teal-600 transition-colors ml-2" />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-3 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => setPendingDelete(sg)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateSubGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        groupId={selectedGroupId}
        participants={participants}
      />

      {pendingDelete && (
        <DeleteConfirmDialog
          subGroup={pendingDelete}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
