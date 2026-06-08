import { VISIBILITY_OPTIONS } from './documentSchema';
import { Checkbox } from '@/components/ui/checkbox';
import type { DocVisibility, GroupParticipant } from '@/lib/types';

interface Props {
  value: DocVisibility;
  onChange: (v: DocVisibility) => void;
  allowedUserIds: string[];
  onAllowedUsersChange: (ids: string[]) => void;
  participants: GroupParticipant[];
}

export function DocumentVisibilityPicker({ value, onChange, allowedUserIds, onAllowedUsersChange, participants }: Props) {
  function toggleUser(id: string) {
    onAllowedUsersChange(
      allowedUserIds.includes(id)
        ? allowedUserIds.filter(u => u !== id)
        : [...allowedUserIds, id],
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Visibility</p>
      <div className="grid grid-cols-1 gap-2">
        {VISIBILITY_OPTIONS.map(opt => {
          const active = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                active
                  ? 'border-violet-400 bg-violet-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={active}
                onChange={() => {
                  onChange(opt.value as DocVisibility);
                  if (opt.value !== 'SELECTED') onAllowedUsersChange([]);
                }}
                className="mt-0.5 accent-violet-600 flex-shrink-0"
              />
              <div>
                <p className={`text-sm font-semibold leading-tight ${active ? 'text-violet-700' : 'text-slate-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          );
        })}
      </div>

      {value === 'SELECTED' && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Select participants ({allowedUserIds.length} chosen)
          </p>
          {participants.length === 0 ? (
            <p className="text-xs text-slate-400">No participants in this group yet.</p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`p-${p.id}`}
                    checked={allowedUserIds.includes(p.id)}
                    onCheckedChange={() => toggleUser(p.id)}
                  />
                  <label htmlFor={`p-${p.id}`} className="text-sm text-slate-700 cursor-pointer leading-tight">
                    {p.full_name}
                    <span className="text-xs text-slate-400 ml-1.5">{p.email}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
