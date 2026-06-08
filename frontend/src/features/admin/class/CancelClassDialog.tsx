import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  classId: string;
  classTitle: string;
  open: boolean;
  onClose: () => void;
}

export function CancelClassDialog({ classId, classTitle, open, onClose }: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => classesApi.update(classId, { status: 'CANCELLED' } as never),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class', classId] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class cancelled.');
      onClose();
    },
    onError: () => toast.error('Failed to cancel class.'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-50 flex-shrink-0">
              <XCircle className="h-5 w-5 text-rose-500" />
            </div>
            <DialogTitle className="text-[#00285A]">Cancel Class</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-500">
            Are you sure you want to cancel{' '}
            <span className="font-semibold text-[#00285A]">{classTitle}</span>?
            <br />
            This action cannot be undone. Participants will no longer see this class as active.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Keep Class
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {mutation.isPending ? 'Cancelling…' : 'Yes, Cancel Class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
