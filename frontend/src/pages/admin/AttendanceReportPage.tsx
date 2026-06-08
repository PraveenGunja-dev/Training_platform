import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useSessionReport } from '@/features/admin/attendance/useSessionReport';
import { ReportSummaryStrip } from '@/features/admin/attendance/ReportSummaryStrip';
import { ReportTable } from '@/features/admin/attendance/ReportTable';
import { exportAttendanceReport } from '@/features/admin/attendance/exportAttendanceReport';
import { PageSkeleton } from '@/components/states/PageSkeleton';
import { ErrorState } from '@/components/states/ErrorState';
import { SessionStatusBadge } from '@/features/admin/attendance/SessionStatusBadge';
import { Button } from '@/components/ui/button';

export default function AdminAttendanceReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useSessionReport(id!);
  const [exporting, setExporting] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError || !data?.data) {
    return <ErrorState title="Report not found" onRetry={() => void refetch()} />;
  }

  const { session, records, summary } = data.data;

  const handleDownload = async () => {
    setExporting(true);
    try {
      exportAttendanceReport(session, records, summary);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/attendance"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Attendance
      </Link>

      <header className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-2xl font-bold truncate">{session.class_title}</h1>
            <SessionStatusBadge status={session.status} />
          </div>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={exporting}
            className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Preparing…' : 'Download Excel'}
          </Button>
        </div>
        <p className="text-sm text-foreground/60">
          Session started {new Date(session.started_at).toLocaleString()}
          {session.ended_at
            ? ` · ended ${new Date(session.ended_at).toLocaleString()}`
            : ' · still active'}
        </p>
        <p className="text-xs text-muted-foreground">
          Started by {session.started_by.full_name}
          {session.ended_by ? ` · ended by ${session.ended_by.full_name}` : ''}
        </p>
      </header>

      <ReportSummaryStrip summary={summary} />

      <ReportTable records={records} />
    </div>
  );
}
