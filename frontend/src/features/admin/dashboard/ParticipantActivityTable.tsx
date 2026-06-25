import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

export interface ParticipantActivity {
  id: string;
  name: string;
  group_name: string;
  attendance_rate: number;
  submission_rate: number;
  last_activity: string | null;
}

type SortKey = 'name' | 'attendance_rate' | 'submission_rate';

interface ParticipantActivityTableProps {
  data: ParticipantActivity[];
  totalParticipants?: number;
}

const PAGE_SIZE = 10;

export function ParticipantActivityTable({ data, totalParticipants }: ParticipantActivityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground/70 py-4">No participant data.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs font-medium hover:bg-transparent"
                  onClick={() => handleSort('name')}
                >
                  Name <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                </Button>
              </TableHead>
              <TableHead>Group</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs font-medium hover:bg-transparent"
                  onClick={() => handleSort('attendance_rate')}
                >
                  Attendance % <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs font-medium hover:bg-transparent"
                  onClick={() => handleSort('submission_rate')}
                >
                  Submission % <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                </Button>
              </TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-sm">{p.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.group_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#EBF3FB] rounded-full">
                      <div
                        className="h-1.5 bg-primary rounded-full"
                        style={{ width: `${p.attendance_rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{p.attendance_rate}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#EBF3FB] rounded-full">
                      <div
                        className="h-1.5 bg-emerald-500 rounded-full"
                        style={{ width: `${p.submission_rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{p.submission_rate}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground/70">
                  {p.last_activity
                    ? new Date(p.last_activity).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Page {page + 1} of {totalPages}
            {totalParticipants !== undefined && totalParticipants > data.length
              ? ` · Showing ${data.length} of ${totalParticipants} participants`
              : ` · ${data.length} participants`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
