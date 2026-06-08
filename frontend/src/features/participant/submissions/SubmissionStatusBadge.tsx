import { Badge } from '@/components/ui/badge';
import type { SubmissionStatus } from '@/lib/types';

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  switch (status) {
    case 'SUBMITTED':
      return <Badge variant="success">Submitted</Badge>;
    case 'LATE_SUBMITTED':
      return <Badge variant="warning">Late Submitted</Badge>;
    case 'OVERRIDE_BY_ADMIN':
      return <Badge variant="info">Override by Admin</Badge>;
  }
}
