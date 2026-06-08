/* eslint-disable react-refresh/only-export-components */
import { Badge } from '@/components/ui/badge';

export type ParticipantTaskState = 'LOCKED' | 'OPEN' | 'LATE_OPEN' | 'SUBMITTED' | 'LATE_SUBMITTED' | 'CLOSED';

export function deriveTaskState(
  task: { is_open: boolean; upload_open_at: string; deadline_at: string; late_policy: string },
  hasSubmission: boolean,
  latestSubStatus?: string,
): ParticipantTaskState {
  if (hasSubmission) {
    return latestSubStatus === 'LATE_SUBMITTED' ? 'LATE_SUBMITTED' : 'SUBMITTED';
  }
  const now = new Date();
  const uploadOpen = new Date(task.upload_open_at);
  const deadline = new Date(task.deadline_at);

  if (now < uploadOpen) return 'LOCKED';
  if (now > deadline) {
    if (task.late_policy === 'LATE_ALLOWED') return 'LATE_OPEN';
    return 'CLOSED';
  }
  return 'OPEN';
}

export function TaskStateBadge({ state }: { state: ParticipantTaskState }) {
  switch (state) {
    case 'LOCKED':
      return <Badge variant="outline" className="text-muted-foreground">Locked</Badge>;
    case 'OPEN':
      return <Badge variant="default" className="bg-primary">Open</Badge>;
    case 'LATE_OPEN':
      return <Badge variant="warning">Late Open</Badge>;
    case 'SUBMITTED':
      return <Badge variant="success">Submitted</Badge>;
    case 'LATE_SUBMITTED':
      return <Badge variant="warning">Late Submitted</Badge>;
    case 'CLOSED':
      return <Badge variant="destructive">Closed</Badge>;
  }
}
