import { Clock, FileText, Image, Video, Bell, CheckCircle2, Shield } from 'lucide-react';
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

function LimitBar({ label, value, max, icon: Icon, color }: {
  label: string; value: number; max: number;
  icon: React.ElementType; color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-xs text-slate-600">{label}</span>
        </div>
        <span className="text-xs font-semibold text-slate-700">{value} MB</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SettingsPreviewSidebar({ values, lastSaved, saving }: Props) {
  const color = values.brand_color || '#4F46E5';
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(color);
  const safeColor = isValidHex ? color : '#4F46E5';
  const lightBg   = safeColor + '18';

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

      {/* ── Brand color preview ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Brand Preview
          </p>
        </div>

        {/* Mini mock UI */}
        <div className="p-4 space-y-3">
          {/* Sidebar strip */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs">
            <div className="w-2 shrink-0 self-stretch" style={{ backgroundColor: safeColor }} />
            <div className="flex-1 px-3 py-2.5 space-y-2">
              {['Dashboard', 'Participants', 'Settings'].map((item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
                  style={i === 2 ? { backgroundColor: lightBg } : {}}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: i === 2 ? safeColor : '#cbd5e1' }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: i === 2 ? safeColor : '#94a3b8' }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Button + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-all"
              style={{ backgroundColor: safeColor }}
            >
              Save changes
            </button>
            <span
              className="text-xs font-medium px-2 py-1 rounded-full border"
              style={{ color: safeColor, borderColor: safeColor + '40', backgroundColor: lightBg }}
            >
              Active
            </span>
          </div>

          {/* Color swatch row */}
          <div className="flex items-center gap-2 pt-1">
            <div
              className="h-6 w-6 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: safeColor }}
            />
            <div
              className="h-6 w-6 rounded-full border-2 border-white shadow opacity-70"
              style={{ backgroundColor: safeColor }}
            />
            <div
              className="h-6 w-6 rounded-full border-2 border-white shadow opacity-40"
              style={{ backgroundColor: safeColor }}
            />
            <span className="text-xs text-slate-400 font-mono ml-1">{safeColor}</span>
          </div>
        </div>
      </div>

      {/* ── Upload limits ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Upload Limits
          </p>
        </div>
        <div className="p-4 space-y-3">
          <LimitBar label="Document" value={values.doc_max_mb}   max={500}  icon={FileText} color="text-violet-500" />
          <LimitBar label="Image"    value={values.image_max_mb} max={100}  icon={Image}    color="text-teal-500"   />
          <LimitBar label="Video"    value={values.video_max_mb} max={2000} icon={Video}    color="text-[#0066BB]" />
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
