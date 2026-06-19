import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { toUTC } from '@/lib/dates';
import { CalendarIcon, Video } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { classesApi } from '@/api/classes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { ClassSession } from '@/lib/types';

const editSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(1000).optional(),
  meeting_link: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v) || undefined,
    z.string().url('Must be a valid URL (e.g. https://meet.google.com/...)').optional(),
  ),
  date: z.date({ required_error: 'Date is required' })
    .refine(d => d >= new Date(new Date().setHours(0, 0, 0, 0)), {
      message: 'Class date cannot be in the past',
    }),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  allow_late_attendance: z.boolean().default(false),
}).refine(d => d.end_time > d.start_time, {
  path: ['end_time'],
  message: 'End time must be after start time',
});

type EditFormValues = z.infer<typeof editSchema>;

interface Props {
  cls: ClassSession;
  open: boolean;
  onClose: () => void;
}

export function EditClassDialog({ cls, open, onClose }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: buildDefaults(cls),
  });

  useEffect(() => {
    if (open) form.reset(buildDefaults(cls));
  }, [open, cls, form]);

  const mutation = useMutation({
    mutationFn: (values: EditFormValues) => {
      const dateStr = format(values.date, 'yyyy-MM-dd');
      return classesApi.update(cls.id, {
        title: values.title,
        description: values.description ?? '',
        meeting_link: values.meeting_link ?? '',
        starts_at: toUTC(new Date(`${dateStr}T${values.start_time}`)),
        ends_at:   toUTC(new Date(`${dateStr}T${values.end_time}`)),
        allow_late_attendance: values.allow_late_attendance,
      } as never);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class', cls.id] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class updated successfully.');
      onClose();
    },
    onError: () => toast.error('Failed to update class.'),
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Class</DialogTitle>
          <DialogDescription>
            Update the details for <span className="font-semibold">{cls.title}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">

          {/* Group — read only */}
          <div className="space-y-1.5">
            <Label>Group</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {cls.group_name}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" {...form.register('title')} />
            {errors.title && <p className="text-xs text-rose-600">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea id="edit-description" {...form.register('description')} rows={2} />
            {errors.description && <p className="text-xs text-rose-600">{errors.description.message}</p>}
          </div>

          {/* Meeting Link */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-meeting_link" className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-emerald-500" />
              Meeting Link
              <span className="text-xs font-normal text-slate-400">(optional)</span>
            </Label>
            <Input
              id="edit-meeting_link"
              type="url"
              {...form.register('meeting_link')}
              placeholder="https://meet.google.com/... or https://zoom.us/j/..."
            />
            {errors.meeting_link && <p className="text-xs text-rose-600">{errors.meeting_link.message}</p>}
          </div>

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
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
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
              <Label htmlFor="edit-start_time">Start Time</Label>
              <input
                id="edit-start_time"
                type="time"
                {...form.register('start_time')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {errors.start_time && <p className="text-xs text-rose-600">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end_time">End Time</Label>
              <input
                id="edit-end_time"
                type="time"
                {...form.register('end_time')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {errors.end_time && <p className="text-xs text-rose-600">{errors.end_time.message}</p>}
            </div>
          </div>

          {/* Allow late attendance */}
          <Controller
            name="allow_late_attendance"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-allow_late"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <label htmlFor="edit-allow_late" className="text-sm cursor-pointer select-none">
                  Allow late attendance marking
                </label>
              </div>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaults(cls: ClassSession): EditFormValues {
  const start = parseISO(cls.starts_at);
  const end   = parseISO(cls.ends_at);
  return {
    title: cls.title,
    description: cls.description ?? '',
    meeting_link: cls.meeting_link ?? '',
    date: start,
    start_time: format(start, 'HH:mm'),
    end_time:   format(end,   'HH:mm'),
    allow_late_attendance: cls.allow_late_attendance,
  };
}
