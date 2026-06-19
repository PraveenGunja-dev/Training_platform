import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ScheduleClassDialog } from '@/features/admin/scheduling/ScheduleClassDialog';
import { classesApi } from '@/api/classes';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';
import type { ClassGroup } from '@/lib/types';

const STATUS_VARIANTS: Record<string, 'success' | 'info' | 'secondary'> = {
  UPCOMING: 'info',
  ONGOING: 'success',
  COMPLETED: 'secondary',
};

export function ClassesTab({ groupId, group }: { groupId: string; group: ClassGroup }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const isInstructor = user?.role === 'INSTRUCTOR';
  const isStaff = isAdmin || isInstructor;
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [subGroupFilter, setSubGroupFilter] = useState('__all__');

  const { data, isLoading } = useQuery({
    queryKey: ['classes', { group_id: groupId }],
    queryFn: () => classesApi.list({ group_id: groupId }),
  });

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', groupId],
    queryFn: () => groupsApi.listSubGroups(groupId),
  });

  const classes = data?.data ?? [];
  const subGroups = subGroupsData?.data ?? [];
  const filtered = subGroupFilter !== '__all__'
    ? classes.filter(c => c.sub_group_id === subGroupFilter)
    : classes;

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100 gap-3">
          <h3 className="font-semibold text-slate-800 shrink-0">Classes</h3>
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
              <Button size="sm" onClick={() => setScheduleOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Schedule Class
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
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {subGroupFilter !== '__all__'
                ? 'No classes scheduled for this sub-group.'
                : 'No classes scheduled for this group yet.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                {isStaff && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow
                  key={c.id}
                  className={isStaff ? 'cursor-pointer hover:bg-slate-50' : ''}
                  onClick={() => {
                    if (isAdmin) navigate(`/admin/classes/${c.id}`);
                    else if (isInstructor) navigate(`/instructor/classes/${c.id}`);
                  }}
                >
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.starts_at, 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.starts_at, 'h:mm a')} – {formatDate(c.ends_at, 'h:mm a')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[c.status] ?? 'secondary'}>
                      {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  {isStaff && (
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ScheduleClassDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        groups={[group]}
        defaultGroupId={group.id}
      />
    </>
  );
}
