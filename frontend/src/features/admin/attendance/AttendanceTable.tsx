import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { attendanceApi } from '@/api/attendance';
import { formatDate } from '@/lib/dates';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AttendanceOverrideDialog } from './AttendanceOverrideDialog';
import { ATTENDANCE_STATUS_COLOR } from './attendanceStatusOptions';
import type { AttendanceStatus } from '@/lib/types';

interface AttendanceTableProps {
  classId: string;
}

interface OverrideTarget {
  userId: string;
  participantName: string;
  currentStatus: AttendanceStatus | null;
}

export function AttendanceTable({ classId }: AttendanceTableProps) {
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['class', classId, 'attendance'],
    queryFn: () => attendanceApi.list(classId),
    enabled: !!classId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-white/8 rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-rose-600">Failed to load attendance data.</p>;
  }

  const rows = data?.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground/70">
        <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No participants in this group yet.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Marked At</TableHead>
            <TableHead>Override By</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.user.id}>
              <TableCell className="font-medium">{row.user.full_name}</TableCell>
              <TableCell>
                {row.status ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ATTENDANCE_STATUS_COLOR[row.status]}`}>
                    {row.status.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 text-sm">Not marked</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.marked_at ? formatDate(row.marked_at, 'h:mm a, dd MMM') : '—'}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.override_by ? 'Super Admin' : '—'}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOverrideTarget({
                    userId: row.user.id,
                    participantName: row.user.full_name,
                    currentStatus: row.status,
                  })}
                >
                  Override
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {overrideTarget && (
        <AttendanceOverrideDialog
          open={!!overrideTarget}
          onClose={() => setOverrideTarget(null)}
          classId={classId}
          userId={overrideTarget.userId}
          participantName={overrideTarget.participantName}
          currentStatus={overrideTarget.currentStatus}
        />
      )}
    </>
  );
}
