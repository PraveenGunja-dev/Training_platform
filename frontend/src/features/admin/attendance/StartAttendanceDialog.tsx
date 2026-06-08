import { useState } from 'react';
import { Radio, Users, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStartSession } from './useStartSession';

const DURATION_PRESETS = [5, 10, 15, 20, 30];

interface Props {
  classId: string;
  className: string;
  participantCount: number;
}

export function StartAttendanceDialog({ classId, className, participantCount }: Props) {
  const [open, setOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [customInput, setCustomInput] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const start = useStartSession();

  const effectiveDuration = useCustom
    ? Math.max(1, Math.min(480, parseInt(customInput, 10) || 0))
    : durationMinutes;
  const isCustomValid = !useCustom || (parseInt(customInput, 10) >= 1 && parseInt(customInput, 10) <= 480);

  function handlePresetClick(val: number) {
    setUseCustom(false);
    setDurationMinutes(val);
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setCustomInput(raw);
    setUseCustom(true);
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
        size="sm"
      >
        <Radio className="h-3.5 w-3.5 mr-1.5" />
        Start Attendance
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100">
                <Radio className="h-4 w-4 text-teal-600" />
              </div>
              <DialogTitle className="text-slate-900">Start Attendance</DialogTitle>
            </div>
            <p className="text-sm text-slate-500">{className}</p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 flex items-center gap-2 text-sm text-teal-700">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span>
                An email notification will be sent to{' '}
                <span className="font-semibold">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>.
                They will also see a banner on their dashboard to mark attendance.
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Clock className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-medium text-slate-700">Attendance Session Window</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {DURATION_PRESETS.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handlePresetClick(val)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      !useCustom && durationMinutes === val
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-600'
                    }`}
                  >
                    {val} min
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 flex-1 px-3 py-1.5 rounded-xl border text-sm transition-colors ${
                  useCustom ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'
                }`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Custom minutes…"
                    value={customInput}
                    onChange={handleCustomChange}
                    onFocus={() => setUseCustom(true)}
                    maxLength={3}
                    className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400 tabular-nums"
                  />
                  <span className="text-slate-400 text-xs flex-shrink-0">min</span>
                </div>
              </div>

              {useCustom && customInput && !isCustomValid && (
                <p className="text-xs text-rose-500 mt-1.5">Enter a value between 1 and 480 minutes.</p>
              )}

              {isCustomValid && effectiveDuration > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Session will automatically close after <span className="font-medium text-slate-600">{effectiveDuration} minute{effectiveDuration !== 1 ? 's' : ''}</span>.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-200">
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={async () => {
                await start.mutateAsync({ classId, durationMinutes: effectiveDuration });
                setOpen(false);
              }}
              disabled={start.isPending || !isCustomValid || effectiveDuration < 1}
            >
              {start.isPending ? 'Opening…' : `Open ${effectiveDuration} min Window`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
