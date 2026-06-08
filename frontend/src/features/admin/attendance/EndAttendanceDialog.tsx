import { useState } from 'react';
import { StopCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEndSession } from './useEndSession';

export function EndAttendanceDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const end = useEndSession();

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
      >
        <StopCircle className="h-3.5 w-3.5 mr-1" />
        End Session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100">
                <StopCircle className="h-4 w-4 text-rose-600" />
              </div>
              <DialogTitle className="text-slate-900">End attendance session?</DialogTitle>
            </div>
            <p className="text-sm text-slate-500">
              Participants will no longer be able to mark attendance after this.
            </p>
          </DialogHeader>

          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
            This action cannot be undone. The session will be permanently closed.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={async () => {
                await end.mutateAsync(sessionId);
                setOpen(false);
              }}
              disabled={end.isPending}
            >
              {end.isPending ? 'Ending…' : 'Yes, end session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
