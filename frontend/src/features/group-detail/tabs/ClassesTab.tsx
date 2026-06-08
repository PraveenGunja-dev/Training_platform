import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ScheduleClassDialog } from '@/features/admin/scheduling/ScheduleClassDialog';
import { classesApi } from '@/api/classes';
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

  const { data, isLoading } = useQuery({
    queryKey: ['classes', { group_id: groupId }],
    queryFn: () => classesApi.list({ group_id: groupId }),
  });

  const classes = data?.data ?? [];

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Indigo accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Classes</h3>
          {isAdmin && (
            <Button size="sm" onClick={() => setScheduleOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Schedule Class
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse" aria-busy="true">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/70">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No classes scheduled for this group yet.</p>
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
              {classes.map(c => (
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
