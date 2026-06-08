import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { useSessionsList } from './useSessionsList';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { SessionStatusBadge } from './SessionStatusBadge';
import { EndAttendanceDialog } from './EndAttendanceDialog';
import { MotionButton } from '@/components/motion/MotionButton';
import { TableSkeleton } from '@/components/states/TableSkeleton';
import { EmptyState } from '@/components/states/EmptyState';
import type { AttendanceSessionStatus } from '@/lib/types';

export function SessionsTable({ filter, reportBasePath = '/admin/attendance/sessions' }: { filter: AttendanceSessionStatus; reportBasePath?: string }) {
  const { data, isLoading } = useSessionsList({ status: filter });

  if (isLoading) return <TableSkeleton rows={4} cols={5} />;

  const sessions = data?.data ?? [];

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-10 w-10" />}
        title={filter === 'ACTIVE' ? 'No active sessions' : 'No past sessions yet'}
        description={
          filter === 'ACTIVE'
            ? 'Start attendance from any Ongoing class detail page.'
            : 'Ended sessions will appear here.'
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Class</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started at</TableHead>
          <TableHead>Ended at</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map(s => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.class_title}</TableCell>
            <TableCell>
              <SessionStatusBadge status={s.status} />
            </TableCell>
            <TableCell className="font-mono text-sm">
              {new Date(s.started_at).toLocaleString()}
            </TableCell>
            <TableCell className="font-mono text-sm text-muted-foreground">
              {s.ended_at ? new Date(s.ended_at).toLocaleString() : '—'}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {s.status === 'ACTIVE' && <EndAttendanceDialog sessionId={s.id} />}
                <Link to={`${reportBasePath}/${s.id}/report`}>
                  <MotionButton size="sm" variant="outline">
                    Show Attendance Report
                  </MotionButton>
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
