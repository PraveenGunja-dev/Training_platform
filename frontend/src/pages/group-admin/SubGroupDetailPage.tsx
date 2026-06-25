import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserCircle, UserPlus, Trash2, Pencil, Check, X, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { groupsApi } from '@/api/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/states/ErrorState';

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-32 bg-teal-100 rounded" />
      <div className="h-28 bg-teal-100 rounded-2xl" />
      <div className="h-48 bg-white rounded-2xl border border-teal-100" />
    </div>
  );
}

export default function GroupAdminSubGroupDetailPage() {
  const { subGroupId } = useParams<{ subGroupId: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const groupIds = user?.admin_of_group_ids ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupIds[0] ?? '');

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const { data: groupData } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId!),
    enabled: !!selectedGroupId,
    staleTime: 60_000,
  });

  const { data: sgData, isLoading, isError, refetch } = useQuery({
    queryKey: ['sub-group', selectedGroupId, subGroupId],
    queryFn: () => groupsApi.getSubGroup(selectedGroupId!, subGroupId!),
    enabled: !!selectedGroupId && !!subGroupId,
    staleTime: 0,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => groupsApi.updateSubGroup(selectedGroupId!, subGroupId!, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sub-group', selectedGroupId, subGroupId] });
      void qc.invalidateQueries({ queryKey: ['sub-groups', selectedGroupId] });
      toast.success('Sub-group renamed.');
      setRenaming(false);
    },
    onError: () => toast.error('Failed to rename sub-group.'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => {
      const currentIds = (sgData?.data?.participants ?? []).map(p => p.id).filter(id => id !== userId);
      return groupsApi.updateSubGroup(selectedGroupId!, subGroupId!, { user_ids: currentIds });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sub-group', selectedGroupId, subGroupId] });
      void qc.invalidateQueries({ queryKey: ['sub-groups', selectedGroupId] });
      toast.success('Participant removed.');
    },
    onError: () => toast.error('Failed to remove participant.'),
  });

  const addMutation = useMutation({
    mutationFn: (newIds: string[]) => {
      const currentIds = (sgData?.data?.participants ?? []).map(p => p.id);
      const merged = [...new Set([...currentIds, ...newIds])];
      return groupsApi.updateSubGroup(selectedGroupId!, subGroupId!, { user_ids: merged });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sub-group', selectedGroupId, subGroupId] });
      void qc.invalidateQueries({ queryKey: ['sub-groups', selectedGroupId] });
      toast.success('Participants added.');
      setAddOpen(false);
      setAddSearch('');
    },
    onError: () => toast.error('Failed to add participants.'),
  });

  const groupName = groupData?.data?.name ?? 'Group';
  const sg = sgData?.data;

  // Participants in this sub-group
  const sgMemberIds = new Set((sg?.participants ?? []).map(p => p.id));

  // Group participants not yet in this sub-group (for the add dialog)
  const available = (groupData?.data?.participants ?? []).filter(p => {
    if (sgMemberIds.has(p.id)) return false;
    if (!addSearch) return true;
    const q = addSearch.toLowerCase();
    return p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });

  const [selected, setSelected] = useState<string[]>([]);

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function startRename() {
    setNameInput(sg?.name ?? '');
    setRenaming(true);
  }

  function confirmRename() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    renameMutation.mutate(trimmed);
  }

  if (groupIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">You are not assigned as admin for any group.</p>
        <p className="text-xs mt-1 text-slate-400">Contact a Super Admin to get access.</p>
      </div>
    );
  }

  if (isLoading) return <Skeleton />;

  if (isError || !sg) {
    return (
      <div className="space-y-4">
        <Link to="/group-admin/sub-groups" className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Sub-Groups
        </Link>
        <ErrorState title="Sub-group not found" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {groupIds.length > 1 && (
        <div className="mb-4">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select group" /></SelectTrigger>
            <SelectContent>
              {groupIds.map(id => <SelectItem key={id} value={id}>{id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Link to="/group-admin/sub-groups" className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Sub-Groups
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-teal-100 shadow-sm overflow-hidden">
        <div className="relative px-6 py-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)' }}>
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/8 pointer-events-none" />
          <div className="absolute -bottom-4 -right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative space-y-1.5">
            <p className="text-xs font-semibold text-teal-200 uppercase tracking-widest">Sub-Group</p>

            {/* Rename inline */}
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/50 font-bold text-xl h-9 max-w-xs focus-visible:ring-white/50"
                  onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenaming(false); }}
                  autoFocus
                />
                <button onClick={confirmRename} disabled={renameMutation.isPending} className="text-white hover:text-teal-100 disabled:opacity-50">
                  {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => setRenaming(false)} className="text-white/70 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{sg.name}</h1>
                <button onClick={startRename} className="text-white/60 hover:text-white transition-colors" title="Rename sub-group">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <p className="text-sm text-teal-200">{groupName}</p>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-semibold border border-white/25">
              <UserCircle className="h-3.5 w-3.5" />
              {sg.participants_count} member{sg.participants_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Participants table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-teal-500 to-teal-300" />
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Participants</h2>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => { setSelected([]); setAddOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add Participants
          </Button>
        </div>

        {sg.participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <UserCircle className="h-10 w-10 text-teal-200 mb-2" />
            <p className="text-sm text-slate-500">No participants in this sub-group yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSelected([]); setAddOpen(true); }}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Add First Participant
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sg.participants.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-400 text-xs w-10">{i + 1}</TableCell>
                  <TableCell className="font-medium text-slate-800">{p.full_name}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{p.email}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Participants Dialog */}
      <Dialog open={addOpen} onOpenChange={v => { if (!v) { setAddOpen(false); setAddSearch(''); setSelected([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Participants</DialogTitle>
            <DialogDescription>Select group members to add to this sub-group.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input className="pl-8" placeholder="Search by name or email..." value={addSearch}
              onChange={e => setAddSearch(e.target.value)} autoFocus />
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground/70 p-4 text-center">
                {addSearch ? 'No matching participants.' : 'All group members are already in this sub-group.'}
              </p>
            ) : available.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-teal-600 shrink-0"
                  checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <p className="text-xs text-muted-foreground">{selected.length} selected</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setAddSearch(''); setSelected([]); }}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={selected.length === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate(selected)}
            >
              {addMutation.isPending ? 'Adding…' : `Add${selected.length > 0 ? ` ${selected.length}` : ''} Selected`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
