import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { toUTC } from '@/lib/dates';
import { CalendarIcon, Video, Users, Repeat, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { scheduleSchema, type ScheduleFormValues } from './scheduleSchema';
import { classesApi } from '@/api/classes';
import { groupsApi } from '@/api/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { ClassGroup } from '@/lib/types';

// ── Recurring schema ────────────────────────────────────────────────────────

const recurringSchema = z.object({
  group_id: z.string().min(1, 'Group is required'),
  sub_group_id: z.string().optional(),
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(1000).optional(),
  meeting_link: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v) || undefined,
    z.string().url('Must be a valid URL').optional(),
  ),
  start_date: z.date({ required_error: 'Start date is required' }),
  end_date: z.date({ required_error: 'End date is required' }),
  days_of_week: z.array(z.number().min(0).max(6)).min(1, 'Select at least one day'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
  allow_late_attendance: z.boolean().default(false),
}).refine(d => d.end_date >= d.start_date, {
  path: ['end_date'],
  message: 'End date must be on or after start date',
}).refine(d => d.end_time > d.start_time, {
  path: ['end_time'],
  message: 'End time must be after start time',
}).refine(d => d.days_of_week.length > 0, {
  path: ['days_of_week'],
  message: 'Select at least one day',
});

type RecurringFormValues = z.infer<typeof recurringSchema>;

// ── Day labels (0=Mon … 6=Sun) ──────────────────────────────────────────────

const DAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

// ── Compute preview count ───────────────────────────────────────────────────

// JS getDay(): 0=Sun,1=Mon…6=Sat → convert to Python weekday(): 0=Mon…6=Sun
function jsToWeekday(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function countRecurringDates(startDate: Date | undefined, endDate: Date | undefined, days: number[]): number {
  if (!startDate || !endDate || days.length === 0) return 0;
  const daySet = new Set(days);
  let count = 0;
  let cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    if (daySet.has(jsToWeekday(cur.getDay()))) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

// ── Time input shared style ─────────────────────────────────────────────────

const timeInputCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

// ── Shared fields (group, sub-group, title, description, meeting-link, allow-late) ──

interface SharedFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  groups: ClassGroup[];
  subGroups: { id: string; name: string; participants_count: number }[];
}

function SharedFields({ form, groups, subGroups }: SharedFieldsProps) {
  const errors = form.formState.errors;
  const selectedGroupId = form.watch('group_id');

  return (
    <>
      {/* Group */}
      <div className="space-y-1.5">
        <Label htmlFor="group_id">Group</Label>
        <Controller
          name="group_id"
          control={form.control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="group_id">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.group_id && <p className="text-xs text-rose-600">{errors.group_id.message}</p>}
      </div>

      {/* Sub-Group */}
      {selectedGroupId && subGroups.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="sub_group_id" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-violet-500" />
            Sub-Group
            <span className="text-xs font-normal text-slate-400">(optional)</span>
          </Label>
          <Controller
            name="sub_group_id"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || '__all__'}
                onValueChange={(v) => field.onChange(v === '__all__' ? '' : v)}
              >
                <SelectTrigger id="sub_group_id">
                  <SelectValue placeholder="All participants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All participants</SelectItem>
                  {subGroups.map(sg => (
                    <SelectItem key={sg.id} value={sg.id}>
                      {sg.name} ({sg.participants_count} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register('title')} placeholder="e.g. Safety Fundamentals — Session 1" />
        {errors.title && <p className="text-xs text-rose-600">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
        <Textarea id="description" {...form.register('description')} rows={2} placeholder="Brief description" />
        {errors.description && <p className="text-xs text-rose-600">{errors.description.message}</p>}
      </div>

      {/* Meeting Link */}
      <div className="space-y-1.5">
        <Label htmlFor="meeting_link" className="flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-emerald-500" />
          Meeting Link
          <span className="text-xs font-normal text-slate-400">(optional)</span>
        </Label>
        <Input
          id="meeting_link"
          type="url"
          {...form.register('meeting_link')}
          placeholder="https://meet.google.com/..."
        />
        {errors.meeting_link && <p className="text-xs text-rose-600">{errors.meeting_link.message}</p>}
      </div>
    </>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ScheduleClassDialogProps {
  open: boolean;
  onClose: () => void;
  groups: ClassGroup[];
  defaultGroupId?: string;
}

// ── Single-class form ───────────────────────────────────────────────────────

function SingleForm({ groups, defaultGroupId, onClose }: Omit<ScheduleClassDialogProps, 'open'>) {
  const queryClient = useQueryClient();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      group_id: defaultGroupId ?? '',
      title: '',
      description: '',
      meeting_link: '',
      date: new Date(),
      start_time: '09:00',
      end_time: '11:00',
      allow_late_attendance: false,
      sub_group_id: '',
    },
  });

  const selectedGroupId = form.watch('group_id');

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', selectedGroupId],
    queryFn: () => groupsApi.listSubGroups(selectedGroupId),
    enabled: !!selectedGroupId,
    staleTime: 30_000,
  });
  const subGroups = subGroupsData?.data ?? [];

  useEffect(() => { form.setValue('sub_group_id', ''); }, [selectedGroupId, form]);

  const mutation = useMutation({
    mutationFn: (values: ScheduleFormValues) => {
      const dateStr = format(values.date, 'yyyy-MM-dd');
      const startsAt = toUTC(new Date(`${dateStr}T${values.start_time}`));
      const endsAt   = toUTC(new Date(`${dateStr}T${values.end_time}`));
      return classesApi.create({
        group_id: values.group_id,
        title: values.title,
        description: values.description,
        meeting_link: values.meeting_link || undefined,
        starts_at: startsAt,
        ends_at: endsAt,
        allow_late_attendance: values.allow_late_attendance,
        sub_group_id: values.sub_group_id || null,
      });
    },
    onSuccess: (_, values) => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['group', values.group_id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin'] });
      toast.success('Class scheduled successfully.');
      onClose();
    },
    onError: () => toast.error('Failed to schedule class.'),
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <SharedFields form={form} groups={groups} subGroups={subGroups} />

      {/* Date */}
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Controller
          name="date"
          control={form.control}
          render={({ field }) => (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={(d) => field.onChange(d ?? new Date())}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.date && <p className="text-xs text-rose-600">{errors.date.message}</p>}
      </div>

      {/* Start / End times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start_time">Start Time</Label>
          <input id="start_time" type="time" {...form.register('start_time')} className={timeInputCls} />
          {errors.start_time && <p className="text-xs text-rose-600">{errors.start_time.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_time">End Time</Label>
          <input id="end_time" type="time" {...form.register('end_time')} className={timeInputCls} />
          {errors.end_time && <p className="text-xs text-rose-600">{errors.end_time.message}</p>}
        </div>
      </div>

      {/* Allow late */}
      <Controller
        name="allow_late_attendance"
        control={form.control}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox id="allow_late" checked={field.value} onCheckedChange={field.onChange} />
            <label htmlFor="allow_late" className="text-sm cursor-pointer select-none">
              Allow late attendance marking
            </label>
          </div>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Scheduling…' : 'Schedule Class'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Recurring form ──────────────────────────────────────────────────────────

function RecurringForm({ groups, defaultGroupId, onClose }: Omit<ScheduleClassDialogProps, 'open'>) {
  const queryClient = useQueryClient();

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      group_id: defaultGroupId ?? '',
      title: '',
      description: '',
      meeting_link: '',
      start_date: new Date(),
      end_date: new Date(),
      days_of_week: [],
      start_time: '09:00',
      end_time: '11:00',
      allow_late_attendance: false,
      sub_group_id: '',
    },
  });

  const selectedGroupId = form.watch('group_id');
  const startDate  = form.watch('start_date');
  const endDate    = form.watch('end_date');
  const daysOfWeek = form.watch('days_of_week');

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', selectedGroupId],
    queryFn: () => groupsApi.listSubGroups(selectedGroupId),
    enabled: !!selectedGroupId,
    staleTime: 30_000,
  });
  const subGroups = subGroupsData?.data ?? [];

  useEffect(() => { form.setValue('sub_group_id', ''); }, [selectedGroupId, form]);

  // Live preview count
  const previewCount = useMemo(
    () => countRecurringDates(startDate, endDate, daysOfWeek),
    [startDate, endDate, daysOfWeek],
  );

  const mutation = useMutation({
    mutationFn: (values: RecurringFormValues) =>
      classesApi.createRecurring({
        group_id: values.group_id,
        title: values.title,
        description: values.description,
        meeting_link: values.meeting_link || undefined,
        allow_late_attendance: values.allow_late_attendance,
        sub_group_id: values.sub_group_id || null,
        start_date: format(values.start_date, 'yyyy-MM-dd'),
        end_date: format(values.end_date, 'yyyy-MM-dd'),
        days_of_week: values.days_of_week,
        start_time: values.start_time,
        end_time: values.end_time,
      }),
    onSuccess: (res, values) => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['group', values.group_id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin'] });
      toast.success(`${res.data.created} class${res.data.created !== 1 ? 'es' : ''} scheduled successfully.`);
      onClose();
    },
    onError: () => toast.error('Failed to schedule recurring classes.'),
  });

  const errors = form.formState.errors;

  function toggleDay(day: number) {
    const current = form.getValues('days_of_week');
    form.setValue(
      'days_of_week',
      current.includes(day) ? current.filter(d => d !== day) : [...current, day],
      { shouldValidate: true },
    );
  }

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <SharedFields form={form} groups={groups} subGroups={subGroups} />

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Controller
            name="start_date"
            control={form.control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {field.value ? format(field.value, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={(d) => {
                      field.onChange(d ?? new Date());
                      // auto-advance end_date if it's before new start
                      const end = form.getValues('end_date');
                      if (d && end < d) form.setValue('end_date', d);
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.start_date && <p className="text-xs text-rose-600">{errors.start_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>End Date</Label>
          <Controller
            name="end_date"
            control={form.control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {field.value ? format(field.value, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={(d) => field.onChange(d ?? new Date())}
                    disabled={(d) => d < (form.getValues('start_date') ?? new Date(new Date().setHours(0, 0, 0, 0)))}
                  />
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.end_date && <p className="text-xs text-rose-600">{errors.end_date.message}</p>}
        </div>
      </div>

      {/* Day-of-week selector */}
      <div className="space-y-2">
        <Label>Repeat on Days</Label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(({ value, label }) => {
            const active = daysOfWeek.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors select-none ${
                  active
                    ? 'bg-[#0052A5] text-white border-[#0052A5]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#0052A5] hover:text-[#0052A5]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {errors.days_of_week && (
          <p className="text-xs text-rose-600">{errors.days_of_week.message}</p>
        )}
      </div>

      {/* Start / End times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="r_start_time">Start Time</Label>
          <input id="r_start_time" type="time" {...form.register('start_time')} className={timeInputCls} />
          {errors.start_time && <p className="text-xs text-rose-600">{errors.start_time.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r_end_time">End Time</Label>
          <input id="r_end_time" type="time" {...form.register('end_time')} className={timeInputCls} />
          {errors.end_time && <p className="text-xs text-rose-600">{errors.end_time.message}</p>}
        </div>
      </div>

      {/* Allow late */}
      <Controller
        name="allow_late_attendance"
        control={form.control}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox id="r_allow_late" checked={field.value} onCheckedChange={field.onChange} />
            <label htmlFor="r_allow_late" className="text-sm cursor-pointer select-none">
              Allow late attendance marking
            </label>
          </div>
        )}
      />

      {/* Live preview */}
      {previewCount > 0 && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
          <CalendarDays className="h-4 w-4 text-[#0052A5] shrink-0" />
          <p className="text-sm text-[#0052A5]">
            This will create <span className="font-semibold">{previewCount} class{previewCount !== 1 ? 'es' : ''}</span>
            {' '}({DAYS.filter(d => daysOfWeek.includes(d.value)).map(d => d.label).join(', ')}{' '}
            between {startDate ? format(startDate, 'dd MMM') : '—'} – {endDate ? format(endDate, 'dd MMM yyyy') : '—'})
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          disabled={mutation.isPending || previewCount === 0}
          className="gap-1.5"
        >
          <Repeat className="h-4 w-4" />
          {mutation.isPending
            ? 'Creating…'
            : previewCount > 0
              ? `Create ${previewCount} Class${previewCount !== 1 ? 'es' : ''}`
              : 'Create Recurring'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Main dialog (mode toggle) ───────────────────────────────────────────────

export function ScheduleClassDialog({ open, onClose, groups, defaultGroupId }: ScheduleClassDialogProps) {
  const [mode, setMode] = useState<'single' | 'recurring'>('single');

  // Reset to single mode when dialog closes
  useEffect(() => {
    if (!open) setMode('single');
  }, [open]);

  function handleClose() {
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule a Class</DialogTitle>
          <DialogDescription>
            Create a single session or set up a recurring schedule.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-[#0052A5] text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Single Class
          </button>
          <button
            type="button"
            onClick={() => setMode('recurring')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
              mode === 'recurring'
                ? 'bg-[#0052A5] text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Repeat className="h-4 w-4" />
            Recurring
          </button>
        </div>

        {mode === 'single' ? (
          <SingleForm groups={groups} defaultGroupId={defaultGroupId} onClose={handleClose} />
        ) : (
          <RecurringForm groups={groups} defaultGroupId={defaultGroupId} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
