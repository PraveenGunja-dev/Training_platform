import { Clock, Bell, CheckCircle2, Shield } from 'lucide-react';
import type { SettingsFormValues } from './settingsSchema';

interface Props {
  values: SettingsFormValues;
  lastSaved: Date | null;
  saving: boolean;
}

function formatOffset(min: number): string {
  if (min >= 1440) return `${min / 1440}d before`;
  if (min >= 60)   return `${min / 60}h before`;
  return `${min}m before`;
}


export function SettingsPreviewSidebar({ values, lastSaved, saving }: Props) {

  return (
    <div className="space-y-4">

      {/* ── Save status ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
        <div className="px-4 py-3 flex items-center gap-2.5">
          {saving ? (
            <>
              <div className="animate-spin h-3.5 w-3.5 border-2 border-violet-500 border-t-transparent rounded-full" />
              <span className="text-xs text-slate-500">Saving…</span>
            </>
          ) : lastSaved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-slate-500">
                Saved at{' '}
                {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          ) : (
            <>
              <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 shrink-0" />
              <span className="text-xs text-slate-400">No changes saved yet</span>
            </>
          )}
        </div>
      </div>

      {/* ── Reminders ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reminders</p>
          <span className="text-xs text-slate-400">{values.reminder_offsets.length} set</span>
        </div>
        <div className="p-4">
          {values.reminder_offsets.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No reminders configured.</p>
          ) : (
            <div className="space-y-1.5">
              {values.reminder_offsets.map(r => (
                <div key={r} className="flex items-center gap-2">
                  <Bell className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-xs text-slate-600">{formatOffset(r)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Security ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Security</p>
        </div>
        <div className="p-4 flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 shrink-0">
            <Shield className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Session lifetime</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {values.session_lifetime_hours}
              <span className="text-sm font-normal text-slate-500 ml-1">hours</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {values.session_lifetime_hours < 24
                ? `${values.session_lifetime_hours}h — short session`
                : values.session_lifetime_hours <= 72
                ? `${Math.round(values.session_lifetime_hours / 24)}d — standard`
                : `${Math.round(values.session_lifetime_hours / 24)}d — long session`}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
