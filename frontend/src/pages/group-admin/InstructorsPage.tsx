import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { groupsApi } from '@/api/groups';
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

// ── AddInstructorDialog ───────────────────────────────────────────────────────

type Instructor = { id: string; full_name: string; email: string };

function AddInstructorDialog({
  open, onClose, groupId,
}: { open: boolean; onClose: () => void; groupId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ['group', groupId, 'available-instructors', debouncedSearch],
    queryFn: () => groupsApi.availableInstructors(groupId, debouncedSearch || undefined),
    enabled: open && !!groupId,
    staleTime: 10_000,
  });

  const assignMutation = useMutation({
    mutationFn: (user: Instructor) => groupsApi.assignInstructors(groupId, [user.id]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', groupId] });
      toast.success('Instructor assigned.');
      handleClose();
    },
    onError: () => toast.error('Failed to assign instructor.'),
  });

  function handleClose() { setSearch(''); setDebouncedSearch(''); onClose(); }

  const available: Instructor[] = data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Instructor</DialogTitle>
          <DialogDescription>Search existing instructors and assign one to your group.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input className="pl-8" placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)} autoFocus />
          {isFetching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground/60" />}
        </div>
        <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
          {available.length === 0 && !isFetching ? (
            <p className="text-sm text-muted-foreground/70 p-4 text-center">
              {search ? 'No matching instructors found.' : 'No available instructors to assign.'}
            </p>
          ) : available.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                  <Badge variant="teal" className="text-[10px] px-1.5 py-0 shrink-0">Instructor</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <Button size="sm" variant="outline"
                className="ml-3 shrink-0 text-teal-700 border-teal-200 hover:bg-teal-50"
                disabled={assignMutation.isPending}
                onClick={() => assignMutation.mutate(u)}
              >
                Assign
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── InstructorsPage ───────────────────────────────────────────────────────────

export default function GroupAdminInstructorsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const groupIds = user?.admin_of_group_ids ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupIds[0] ?? '');
  const [addOpen, setAddOpen] = useState(false);

  const { data: groupData, isLoading } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.unassignInstructor(selectedGroupId!, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['group', selectedGroupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-instructors', selectedGroupId] });
      toast.success('Instructor removed.');
    },
    onError: () => toast.error('Failed to remove instructor.'),
  });

  if (groupIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">You are not assigned as admin for any group.</p>
        <p className="text-xs mt-1 text-slate-400">Contact a Super Admin to get access.</p>
      </div>
    );
  }

  const instructors = groupData?.data?.instructors ?? [];

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
            <GraduationCap className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Instructors</h1>
            <p className="text-sm text-slate-500">
              {instructors.length} instructor{instructors.length !== 1 ? 's' : ''} in your group
            </p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Instructor
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : instructors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <GraduationCap className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No instructors assigned yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add First Instructor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.map(ins => (
                <TableRow key={ins.id}>
                  <TableCell className="font-medium text-slate-800">{ins.full_name}</TableCell>
                  <TableCell className="text-slate-500">{ins.email}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(ins.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AddInstructorDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        groupId={selectedGroupId}
      />
    </div>
  );
}
