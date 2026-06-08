import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { CreateAssignmentDialog } from '@/features/admin/assignments/CreateAssignmentDialog';
import { assignmentsApi } from '@/api/assignments';
import { formatDate } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';
import { TaskStateBadge, deriveTaskState } from '@/features/participant/tasks/TaskStateBadge';
import type { ClassGroup } from '@/lib/types';

export function AssignmentsTab({ groupId, group }: { groupId: string; group: ClassGroup }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', 'group', groupId],
    queryFn: () => assignmentsApi.list({ group_id: groupId }),
  });

  const tasks = data?.data ?? [];

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Assignments</h3>
          {isAdmin && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Assignment
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No assignments created for this group yet.</p>
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
              {tasks.map(task => (
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
