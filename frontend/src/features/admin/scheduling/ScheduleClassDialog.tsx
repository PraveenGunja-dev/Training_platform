import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toUTC } from '@/lib/dates';
import { CalendarIcon, Video } from 'lucide-react';
import { toast } from 'sonner';
import { scheduleSchema, type ScheduleFormValues } from './scheduleSchema';
import { classesApi } from '@/api/classes';
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

interface ScheduleClassDialogProps {
  open: boolean;
  onClose: () => void;
  groups: ClassGroup[];
  defaultGroupId?: string;
}

export function ScheduleClassDialog({ open, onClose, groups, defaultGroupId }: ScheduleClassDialogProps) {
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
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        group_id: defaultGroupId ?? '',
        title: '',
        description: '',
        meeting_link: '',
        date: new Date(),
        start_time: '09:00',
        end_time: '11:00',
        allow_late_attendance: false,
      });
    }
  }, [open, defaultGroupId, form]);

  const mutation = useMutation({
    mutationFn: (values: ScheduleFormValues) => {
      const dateStr = format(values.date, 'yyyy-MM-dd');
      const startsAt = toUTC(new Date(`${dateStr}T${values.start_time}`));
      const endsAt = toUTC(new Date(`${dateStr}T${values.end_time}`));
      return classesApi.create({
        group_id: values.group_id,
        title: values.title,
        description: values.description,
        meeting_link: values.meeting_link || undefined,
        starts_at: startsAt,
        ends_at: endsAt,
        allow_late_attendance: values.allow_late_attendance,
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule a Class</DialogTitle>
          <DialogDescription>
            Fill in the details to schedule a new class session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
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

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} placeholder="e.g. Safety Fundamentals — Session 1" />
            {errors.title && <p className="text-xs text-rose-600">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" {...form.register('description')} rows={2} placeholder="Brief description of the class" />
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
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && <p className="text-xs text-rose-600">{errors.date.message}</p>}
          </div>

          {/* Start/End times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start Time</Label>
              <input
                id="start_time"
                type="time"
                {...form.register('start_time')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {errors.start_time && <p className="text-xs text-rose-600">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">End Time</Label>
              <input
                id="end_time"
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
                  id="allow_late_attendance"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <label htmlFor="allow_late_attendance" className="text-sm cursor-pointer select-none">
                  Allow late attendance marking
                </label>
              </div>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Scheduling...' : 'Schedule Class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
