import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { CreateAssignmentDialog } from '@/features/admin/assignments/CreateAssignmentDialog';
import { assignmentsApi } from '@/api/assignments';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';
import { TaskStateBadge, deriveTaskState } from '@/features/participant/tasks/TaskStateBadge';
import type { ClassGroup } from '@/lib/types';

export function AssignmentsTab({ groupId, group }: { groupId: string; group: ClassGroup }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [createOpen, setCreateOpen] = useState(false);
  const [subGroupFilter, setSubGroupFilter] = useState('__all__');

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', 'group', groupId],
    queryFn: () => assignmentsApi.list({ group_id: groupId }),
  });

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', groupId],
    queryFn: () => groupsApi.listSubGroups(groupId),
  });

  const tasks = data?.data ?? [];
  const subGroups = subGroupsData?.data ?? [];
  const filtered = subGroupFilter !== '__all__'
    ? tasks.filter(t => t.sub_group_id === subGroupFilter)
    : tasks;

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100 gap-3">
          <h3 className="font-semibold text-slate-800 shrink-0">Assignments</h3>
          <div className="flex items-center gap-2 ml-auto">
            {subGroups.length > 0 && (
              <Select value={subGroupFilter} onValueChange={setSubGroupFilter}>
                <SelectTrigger className="h-8 w-44 text-sm">
                  <SelectValue placeholder="All sub-groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sub-groups</SelectItem>
                  {subGroups.map(sg => (
                    <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdmin && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                New Assignment
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {subGroupFilter !== '__all__'
                ? 'No assignments created for this sub-group.'
                : 'No assignments created for this group yet.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Opens</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(task => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(task.upload_open_at, 'dd MMM h:mm a')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(task.deadline_at, 'dd MMM h:mm a')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground/70">
                    {task.late_policy.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell>
                    <TaskStateBadge state={deriveTaskState(task, false)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateAssignmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        groups={[group]}
        defaultGroupId={group.id}
      />
    </>
  );
}
