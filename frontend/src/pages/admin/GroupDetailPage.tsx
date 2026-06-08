import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { GroupHeader } from '@/features/group-detail/GroupHeader';
import { GroupTabs } from '@/features/group-detail/GroupTabs';
import { groupsApi } from '@/api/groups';
import axios from 'axios';

export default function AdminGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.get(id!),
    retry: (count, err) => {
      if (axios.isAxiosError(err) && err.response?.status === 404) return false;
      return count < 2;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.delete(id!),
    onSuccess: () => {
      toast.success('Group deleted successfully.');
      navigate('/admin/groups');
    },
    onError: () => {
      toast.error('Failed to delete group. Please try again.');
      setShowDeleteDialog(false);
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
        <Button variant="outline" onClick={() => navigate('/admin/groups')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to All Groups
        </Button>
      </div>
    );
  }

  const group = data.data;

  return (
    <>
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => navigate('/admin/groups')}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          All Groups
        </Button>

        <GroupHeader group={group} onDeleteClick={() => setShowDeleteDialog(true)} />
        <GroupTabs group={group} />
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-left">Delete Group?</DialogTitle>
            </div>
            <DialogDescription className="text-left">
              You are about to delete{' '}
              <span className="font-semibold text-foreground">{group.name}</span>.
              This will remove the group and all its associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
