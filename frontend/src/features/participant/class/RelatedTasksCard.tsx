import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RelatedTask } from '@/lib/types';

function taskStateBadge(task: RelatedTask) {
  const now = new Date();
  if (task.is_open) return <Badge variant="success">Open</Badge>;
  if (!task.is_closed && new Date(task.upload_open_at) > now)
    return <Badge variant="info">Locked</Badge>;
  return <Badge variant="secondary">Closed</Badge>;
}

interface Props {
  tasks: RelatedTask[];
  linkPrefix?: string;
}

export function RelatedTasksCard({ tasks, linkPrefix = '/me/tasks' }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Related Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground/70">No tasks linked to this class.</p>
        )}
        {tasks.map(task => (
          <div key={task.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {taskStateBadge(task)}
              <span className="text-sm text-foreground/90 truncate">{task.title}</span>
            </div>
            <Link
              to={`${linkPrefix}/${task.id}`}
              className="text-primary hover:text-primary/80 shrink-0 ml-2"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
