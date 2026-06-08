import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Trash2, UserCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { groupsApi } from '@/api/groups';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/auth';
import type { GroupParticipant, User } from '@/lib/types';

// ---------------------------------------------------------------------------
// AddParticipantsDialog — search by name, email, or ID
// ---------------------------------------------------------------------------

interface AddParticipantsDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  existingIds: string[];
}

function AddParticipantsDialog({ open, onClose, groupId, existingIds }: AddParticipantsDialogProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<User[]>([]);

  const { data, isFetching } = useQuery({
    queryKey: ['users', 'participant-search', query],
    queryFn: () => usersApi.list({ role: 'PARTICIPANT', search: query, page_size: 30 }),
    enabled: open,
    staleTime: 10_000,
  });

  const results = (data?.data ?? []).filter(u => !existingIds.includes(u.id));

  const mutation = useMutation({
    mutationFn: (users: User[]) => groupsApi.addParticipants(groupId, users.map(u => u.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success(`${selected.length} participant${selected.length !== 1 ? 's' : ''} added.`);
      setSelected([]);
      setQuery('');
      onClose();
    },
    onError: () => toast.error('Failed to add participants.'),
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Participants</DialogTitle>
          <DialogDescription>
            Search by name, email, or ID to find and add participants.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            className="pl-8"
            placeholder="Search by name, email, or ID..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground/60" />
          )}
        </div>

        {/* Results list */}
        <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
          {results.length === 0 && !isFetching ? (
            <p className="text-sm text-muted-foreground/70 p-4 text-center">
              {query ? 'No matching participants found.' : 'No available participants.'}
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
                {!user.is_active && (
                  <Badge variant="secondary" className="ml-auto shrink-0 text-xs">Inactive</Badge>
                )}
              </label>
            ))
          )}
        </div>

        {/* Selected summary */}
        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selected.length} participant{selected.length !== 1 ? 's' : ''} selected:{' '}
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
              ? 'Adding...'
              : `Add${selected.length > 0 ? ` ${selected.length}` : ''} Selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ParticipantsTab
// ---------------------------------------------------------------------------

interface ParticipantsTabProps {
  groupId: string;
  participants: GroupParticipant[];
}

export function ParticipantsTab({ groupId, participants }: ParticipantsTabProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const filtered = participants.filter(p =>
    search === '' ||
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()),
  );

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.removeParticipant(groupId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success('Participant removed.');
    },
    onError: () => toast.error('Failed to remove participant.'),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search participants..."
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Add Participants
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <UserCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {participants.length === 0 ? 'No participants in this group yet.' : 'No results for your search.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Submissions</TableHead>
                {isAdmin && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? 'success' : 'secondary'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={p.attendance_rate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                      {p.attendance_rate}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={p.submission_rate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                      {p.submission_rate}%
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeMutation.mutate(p.id)}
                        disabled={removeMutation.isPending}
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

      <AddParticipantsDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        groupId={groupId}
        existingIds={participants.map(p => p.id)}
      />
    </div>
  );
}
