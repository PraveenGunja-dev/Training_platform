import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { ReportRow } from '@/lib/types';

export function ReportTable({ records }: { records: ReportRow[] }) {
  const present = records.filter(r => r.status === 'PRESENT');
  const absent = records.filter(r => r.status === 'ABSENT');

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Present ({present.length})</h2>
        {present.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No participants have marked attendance yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Marked at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {present.map(r => (
                <TableRow key={r.user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-brand-teal/20 text-brand-teal">
                          {r.user.full_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{r.user.full_name}</div>
                        <div className="text-xs text-foreground/50">{r.user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-brand-teal">
                    {new Date(r.marked_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3 text-foreground/70">Absent ({absent.length})</h2>
        {absent.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">All participants marked attendance.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {absent.map(r => (
                <TableRow key={r.user.id} className="opacity-60">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {r.user.full_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm">{r.user.full_name}</div>
                        <div className="text-xs text-foreground/50">{r.user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/55">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
