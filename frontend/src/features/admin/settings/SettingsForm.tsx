import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Globe,
  HardDrive,
  Bell,
  ShieldAlert,
  X,
  Plus,
  RefreshCw,
  LogOut,
  Palette,
  GraduationCap,
} from 'lucide-react';
import { settingsSchema, type SettingsFormValues } from './settingsSchema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SystemSettings } from '@/lib/types';

interface SettingsFormProps {
  initialValues: SystemSettings;
  onSubmit: (values: SettingsFormValues) => Promise<void>;
  onForceLogout: () => Promise<void>;
  onValuesChange?: (values: SettingsFormValues) => void;
  saving: boolean;
  loggingOut: boolean;
}

const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Riyadh',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Toronto',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

const REMINDER_PRESETS = [5, 10, 15, 30, 60, 120, 1440];

const DEFAULT_VALUES: SystemSettings = {
  product_name: 'Training Management System',
  timezone: 'UTC',
  brand_color: '#4F46E5',
  doc_max_mb: 25,
  image_max_mb: 10,
  video_max_mb: 500,
  reminder_offsets: [60, 30, 10],
  session_lifetime_hours: 24,
  instructors_can_view_all_classes: false,
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function formatOffset(min: number): string {
  if (min >= 1440) return `${min / 1440}d`;
  if (min >= 60) return `${min / 60}h`;
  return `${min}m`;
}

export function SettingsForm({
  initialValues,
  onSubmit,
  onForceLogout,
  onValuesChange,
  saving,
  loggingOut,
}: SettingsFormProps) {
  const [newOffset, setNewOffset] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const offsetInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    const sub = watch(values => onValuesChange?.(values as SettingsFormValues));
    return () => sub.unsubscribe();
  }, [watch, onValuesChange]);

  const reminders = watch('reminder_offsets') ?? [];
  const brandColor = watch('brand_color') ?? '#4F46E5';
  const instructorViewAll = watch('instructors_can_view_all_classes') ?? false;

  const addOffset = (val?: number) => {
    const raw = val ?? parseInt(newOffset, 10);
    if (!Number.isNaN(raw) && raw > 0 && !reminders.includes(raw)) {
      setValue('reminder_offsets', [...reminders, raw].sort((a, b) => b - a), {
        shouldDirty: true,
      });
    }
    setNewOffset('');
    offsetInputRef.current?.focus();
  };

  const removeOffset = (val: number) =>
    setValue('reminder_offsets', reminders.filter(r => r !== val), { shouldDirty: true });

  const handleResetDefaults = () => {
    reset(DEFAULT_VALUES);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* ── General ───────────────────────────────────────────────── */}
      <SectionCard
        icon={Globe}
        title="General"
        description="Product identity and regional settings"
        accent="bg-gradient-to-r from-violet-500 to-indigo-500"
      >
        <div className="space-y-1.5">
          <Label>Product Name</Label>
          <Input {...register('product_name')} placeholder="Training Management System" />
          {errors.product_name && (
            <p className="text-xs text-red-500">{errors.product_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Default Timezone</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            {...register('timezone')}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Primary Brand Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={e => setValue('brand_color', e.target.value, { shouldDirty: true })}
              className="h-9 w-14 rounded-md border border-slate-200 cursor-pointer p-0.5 bg-white"
            />
            <Input
              {...register('brand_color')}
              placeholder="#4F46E5"
              className="w-32 font-mono text-sm"
            />
          </div>
          {errors.brand_color && (
            <p className="text-xs text-red-500">{errors.brand_color.message}</p>
          )}
          {/* Live preview */}
          <div className="mt-2 rounded-xl overflow-hidden border border-slate-200">
            <div className="h-2" style={{ backgroundColor: brandColor }} />
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ backgroundColor: brandColor + '20' }}
              >
                <Palette className="h-4 w-4" style={{ color: brandColor }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Accent preview</p>
                <p className="text-xs text-slate-500">{brandColor}</p>
              </div>
              <button
                type="button"
                className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                style={{ backgroundColor: brandColor }}
              >
                Sample button
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── File Upload Limits ────────────────────────────────────── */}
      <SectionCard
        icon={HardDrive}
        title="File Upload Limits"
        description="Maximum file sizes accepted during uploads"
        accent="bg-gradient-to-r from-teal-500 to-emerald-500"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Document (MB)</Label>
            <Input
              type="number"
              min={1}
              max={500}
              {...register('doc_max_mb', { valueAsNumber: true })}
            />
            {errors.doc_max_mb && (
              <p className="text-xs text-red-500">{errors.doc_max_mb.message}</p>
            )}
            <p className="text-xs text-slate-400">PDF, DOCX etc. Max 500 MB</p>
          </div>
          <div className="space-y-1.5">
            <Label>Image (MB)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              {...register('image_max_mb', { valueAsNumber: true })}
            />
            {errors.image_max_mb && (
              <p className="text-xs text-red-500">{errors.image_max_mb.message}</p>
            )}
            <p className="text-xs text-slate-400">JPG, PNG etc. Max 100 MB</p>
          </div>
          <div className="space-y-1.5">
            <Label>Video (MB)</Label>
            <Input
              type="number"
              min={1}
              max={2000}
              {...register('video_max_mb', { valueAsNumber: true })}
            />
            {errors.video_max_mb && (
              <p className="text-xs text-red-500">{errors.video_max_mb.message}</p>
            )}
            <p className="text-xs text-slate-400">MP4, MOV etc. Max 2000 MB</p>
          </div>
        </div>
      </SectionCard>

      {/* ── Reminders ─────────────────────────────────────────────── */}
      <SectionCard
        icon={Bell}
        title="Reminders"
        description="Notify participants before assignment deadlines"
        accent="bg-gradient-to-r from-amber-400 to-orange-400"
      >
        <div className="flex flex-wrap gap-2">
          {reminders.length === 0 && (
            <p className="text-xs text-slate-400 italic">No reminder offsets configured.</p>
          )}
          {reminders.map(r => (
            <span
              key={r}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1"
            >
              {formatOffset(r)} before
              <button
                type="button"
                onClick={() => removeOffset(r)}
                className="hover:text-red-600 transition-colors"
                aria-label={`Remove ${r} min reminder`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium">Quick add:</p>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.map(p => (
              <button
                key={p}
                type="button"
                disabled={reminders.includes(p)}
                onClick={() => addOffset(p)}
                className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {formatOffset(p)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Input
            ref={offsetInputRef}
            type="number"
            min={1}
            placeholder="Custom minutes…"
            value={newOffset}
            onChange={e => setNewOffset(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOffset();
              }
            }}
            className="w-40 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => addOffset()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </SectionCard>

      {/* ── Security ──────────────────────────────────────────────── */}
      <SectionCard
        icon={ShieldAlert}
        title="Security"
        description="Session management and access control"
        accent="bg-gradient-to-r from-rose-500 to-pink-500"
      >
        <div className="space-y-1.5">
          <Label>Session Token Lifetime (hours)</Label>
          <Input
            type="number"
            min={1}
            max={720}
            {...register('session_lifetime_hours', { valueAsNumber: true })}
            className="w-36"
          />
          {errors.session_lifetime_hours && (
            <p className="text-xs text-red-500">{errors.session_lifetime_hours.message}</p>
          )}
          <p className="text-xs text-slate-400">
            How long a refresh token stays valid (1–720 h). Applied to new logins.
          </p>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Force Logout All Users</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Immediately invalidates every active session except yours.
            </p>
          </div>

          {confirmLogout ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <p className="text-xs text-rose-700 flex-1">
                This will sign out all other users right now. Are you sure?
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs border-rose-300 text-rose-700 hover:bg-rose-100 shrink-0"
                disabled={loggingOut}
                onClick={async () => {
                  await onForceLogout();
                  setConfirmLogout(false);
                }}
              >
                {loggingOut ? 'Signing out…' : 'Yes, sign out all'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs shrink-0"
                onClick={() => setConfirmLogout(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Force Logout All Users
            </Button>
          )}
        </div>
      </SectionCard>

      {/* ── Instructor Calendar Visibility ────────────────────────── */}
      <SectionCard
        icon={GraduationCap}
        title="Instructor Calendar Visibility"
        description="Control which classes instructors can see by default"
        accent="bg-gradient-to-r from-[#0052A5] to-[#E31837]"
      >
        <div className="flex items-start gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={instructorViewAll}
            onClick={() =>
              setValue('instructors_can_view_all_classes', !instructorViewAll, {
                shouldDirty: true,
              })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
              instructorViewAll ? 'bg-[#E31837]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                instructorViewAll ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Allow instructors to view classes from all groups (read-only)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              When on, instructors see every class on the calendar and reports. They can
              still only edit classes for groups they are assigned to.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-500 text-xs"
            onClick={handleResetDefaults}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reset to defaults
          </Button>
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>
        <Button type="submit" disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
