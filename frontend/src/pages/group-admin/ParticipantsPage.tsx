import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Trash2, UserCircle, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { groupsApi } from '@/api/groups';
import { usersApi } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { User, GroupParticipant } from '@/lib/types';

// ── AddParticipantsDialog ─────────────────────────────────────────────────────

function AddParticipantsDialog({
  open, onClose, groupId, existingIds,
}: { open: boolean; onClose: () => void; groupId: string; existingIds: string[] }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<User[]>([]);

  const { data, isFetching } = useQuery({
    queryKey: ['users', 'participant-search', query],
    queryFn: () => usersApi.list({ role: 'PARTICIPANT', search: query || undefined, page_size: 30 }),
    enabled: open,
    staleTime: 10_000,
  });

  const results = (data?.data ?? []).filter(u => !existingIds.includes(u.id) && u.is_active);

  const mutation = useMutation({
    mutationFn: (users: User[]) => groupsApi.addParticipants(groupId, users.map(u => u.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success(`${selected.length} participant${selected.length !== 1 ? 's' : ''} added.`);
      setSelected([]); setQuery(''); onClose();
    },
    onError: () => toast.error('Failed to add participants.'),
  });

  function toggle(user: User) {
    setSelected(prev => prev.some(u => u.id === user.id) ? prev.filter(u => u.id !== user.id) : [...prev, user]);
  }
  function handleClose() { setSelected([]); setQuery(''); onClose(); }
  const selectedIds = new Set(selected.map(u => u.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Participants</DialogTitle>
          <DialogDescription>Search by name or email to add participants to your group.</DialogDescription>
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
              {query ? 'No matching participants found.' : 'No available participants.'}
            </p>
          ) : results.map(user => (
            <label key={user.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" className="h-4 w-4 accent-primary shrink-0"
                checked={selectedIds.has(user.id)} onChange={() => toggle(user)} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
            {mutation.isPending ? 'Adding...' : `Add${selected.length > 0 ? ` ${selected.length}` : ''} Selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ParticipantsPage ──────────────────────────────────────────────────────────

export default function GroupAdminParticipantsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groupIds = user?.admin_of_group_ids ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupIds[0] ?? '');

  const [search, setSearch] = useState('');
  const [subGroupFilter, setSubGroupFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const { data: groupData, isLoading } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', selectedGroupId],
    queryFn: () => groupsApi.listSubGroups(selectedGroupId!),
    enabled: !!selectedGroupId,
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.removeParticipant(selectedGroupId!, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', selectedGroupId] });
      toast.success('Participant removed.');
    },
    onError: () => toast.error('Failed to remove participant.'),
  });

  if (groupIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">You are not assigned as admin for any group.</p>
        <p className="text-xs mt-1 text-slate-400">Contact a Super Admin to get access.</p>
      </div>
    );
  }

  const participants: GroupParticipant[] = groupData?.data?.participants ?? [];
  const subGroups = subGroupsData?.data ?? [];

  const subGroupMemberIds = subGroupFilter
    ? new Set(subGroups.find(sg => sg.id === subGroupFilter)?.participants.map(p => p.id) ?? [])
    : null;

  const filtered = participants.filter(p => {
    if (subGroupMemberIds && !subGroupMemberIds.has(p.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

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
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100">
          <Users className="h-5 w-5 text-teal-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Participants</h1>
          <p className="text-sm text-slate-500">{participants.length} member{participants.length !== 1 ? 's' : ''} in your group</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />

        {/* Toolbar */}
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search participants..." className="pl-8"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {subGroups.length > 0 && (
            <select
              value={subGroupFilter}
              onChange={e => setSubGroupFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All participants</option>
              {subGroups.map(sg => (
                <option key={sg.id} value={sg.id}>{sg.name} ({sg.participants_count})</option>
              ))}
            </select>
          )}
          <Button size="sm" className="ml-auto bg-teal-600 hover:bg-teal-700" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add Participants
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <UserCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {participants.length === 0 ? 'No participants in this group yet.' : 'No results for your search.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const groupName = groupData?.data?.name;
                return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-slate-50/60"
                  onClick={() => navigate(`/group-admin/participants/${p.id}`, { state: { participant: p, groupName } })}
                >
                  <TableCell>
                    <span className="font-medium text-[#0052A5] hover:underline">{p.full_name || '—'}</span>
                  </TableCell>
                  <TableCell className="text-slate-500">{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? 'teal' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={p.attendance_rate >= 80 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                      {p.attendance_rate}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={p.submission_rate >= 80 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                      {p.submission_rate}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeMutation.mutate(p.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AddParticipantsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        groupId={selectedGroupId}
        existingIds={participants.map(p => p.id)}
      />
    </div>
  );
}
