import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroupHeader } from '@/features/group-detail/GroupHeader';
import { GroupTabs } from '@/features/group-detail/GroupTabs';
import { groupsApi } from '@/api/groups';
import axios from 'axios';

export default function InstructorGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.get(id!),
    retry: (count, err) => {
      if (axios.isAxiosError(err) && err.response?.status === 404) return false;
      return count < 2;
    },
  });

  const is404 = axios.isAxiosError(error) && error.response?.status === 404;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
        <div className="h-10 bg-white/10 rounded w-full mt-6" />
        <div className="h-64 bg-white/10 rounded w-full" />
      </div>
    );
  }

  if (is404 || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <AlertTriangle className="h-12 w-12 text-foreground/40" />
        <h2 className="text-lg font-semibold text-foreground">Group Not Found</h2>
        <p className="text-sm text-muted-foreground">This group does not exist or has been deleted.</p>
        <Button variant="outline" onClick={() => navigate('/instructor/groups')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Assigned Groups
        </Button>
      </div>
    );
  }

  const group = data.data;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/instructor/groups')}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Assigned Groups
      </Button>

      <GroupHeader group={group} />
      <GroupTabs group={group} />
    </div>
  );
}
