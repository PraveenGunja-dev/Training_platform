import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { ATTENDANCE_STATUS_OPTIONS } from './attendanceStatusOptions';
import type { AttendanceStatus } from '@/lib/types';

interface AttendanceOverrideDialogProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  userId: string;
  participantName: string;
  currentStatus: AttendanceStatus | null;
}

export function AttendanceOverrideDialog({
  open, onClose, classId, userId, participantName, currentStatus,
}: AttendanceOverrideDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AttendanceStatus>(currentStatus ?? 'MANUAL_PRESENT');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => attendanceApi.override(classId, userId, { status, note: note || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class', classId, 'attendance'] });
      toast.success(`Attendance updated to ${status.replace(/_/g, ' ')}.`);
      setNote('');
      onClose();
    },
    onError: () => toast.error('Failed to update attendance.'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Override Attendance</DialogTitle>
          <DialogDescription>
            Manually set attendance for <span className="font-medium">{participantName}</span>.
            This action will be audit-logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override_note">Note (optional)</Label>
            <Textarea
              id="override_note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for override..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
