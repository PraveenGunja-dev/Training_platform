import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, X, ClipboardList, Users } from 'lucide-react';
import { assignmentSchema, type AssignmentFormValues } from './assignmentSchema';
import { validateFile } from '@/lib/fileValidation';
import { ReminderOffsetsInput } from './ReminderOffsetsInput';
import { assignmentsApi } from '@/api/assignments';
import { classesApi } from '@/api/classes';
import { groupsApi } from '@/api/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { ClassGroup, LatePolicy } from '@/lib/types';

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LATE_POLICY_OPTIONS: Array<{ value: LatePolicy; label: string; description: string }> = [
  { value: 'STRICT',       label: 'Strict Deadline',  description: 'No submissions accepted after deadline.' },
  { value: 'LATE_ALLOWED', label: 'Late Allowed',     description: 'Late submissions accepted, marked accordingly.' },
  { value: 'ADMIN_ONLY',   label: 'Admin Only',       description: 'Only admin can submit on behalf after deadline.' },
];

interface CreateAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  groups: ClassGroup[];
  defaultGroupId?: string;
  defaultClassId?: string;
}

export function CreateAssignmentDialog({ open, onClose, groups, defaultGroupId, defaultClassId }: CreateAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'saving'>('idle');

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      group_id:        defaultGroupId ?? '',
      class_id:        defaultClassId ?? '',
      title:           '',
      question:        '',
      description:     '',
      instructions:    '',
      upload_open_at:  toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
      deadline_at:     toDatetimeLocal(new Date(Date.now() + 7 * 60 * 60 * 1000)),
      late_policy:     'STRICT',
      reminder_offsets:[60, 30, 10],
      sub_group_id:    '',
    },
  });

  const selectedGroupId = form.watch('group_id');

  const { data: classesData } = useQuery({
    queryKey: ['classes', { group_id: selectedGroupId }],
    queryFn:  () => classesApi.list({ group_id: selectedGroupId }),
    enabled:  !!selectedGroupId,
  });
  const groupClasses = classesData?.data ?? [];

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', selectedGroupId],
    queryFn: () => groupsApi.listSubGroups(selectedGroupId),
    enabled: !!selectedGroupId,
    staleTime: 30_000,
  });
  const subGroups = subGroupsData?.data ?? [];

  useEffect(() => {
    if (!open) {
      form.reset({
        group_id:        defaultGroupId ?? '',
        class_id:        defaultClassId ?? '',
        title:           '',
        question:        '',
        description:     '',
        instructions:    '',
        upload_open_at:  toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
        deadline_at:     toDatetimeLocal(new Date(Date.now() + 7 * 60 * 60 * 1000)),
        late_policy:     'STRICT',
        reminder_offsets:[60, 30, 10],
      sub_group_id:    '',
      });
      setPendingFile(null);
      setUploadProgress('idle');
    }
  }, [open, defaultGroupId, defaultClassId, form]);

  useEffect(() => {
    if (!defaultClassId) form.setValue('class_id', '');
    form.setValue('sub_group_id', '');
  }, [selectedGroupId, defaultClassId, form]);

  const pickFile = useCallback((file: File) => {
    setPendingFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, [pickFile]);

  const mutation = useMutation({
    mutationFn: async (values: AssignmentFormValues) => {
      if (pendingFile) {
        // Validate file before upload
        const validation = validateFile(pendingFile);
        if (!validation.ok) {
          toast.error(validation.error);
          setUploadProgress('idle');
          return;
        }
      }

      setUploadProgress('saving');
      const taskResult = await assignmentsApi.create({
        group_id:         values.group_id,
        class_id:         values.class_id || undefined,
        title:            values.title,
        question:         values.question,
        description:      values.description || undefined,
        instructions:     values.instructions || undefined,
        upload_open_at:   new Date(values.upload_open_at).toISOString(),
        deadline_at:      new Date(values.deadline_at).toISOString(),
        late_policy:      values.late_policy,
        reminder_offsets: values.reminder_offsets,
        sub_group_id:     values.sub_group_id || null,
      });

      if (pendingFile && taskResult?.data?.id) {
        setUploadProgress('saving');
        await assignmentsApi.uploadQuestionFile(taskResult.data.id, pendingFile);
      }

      return taskResult;
    },
    onSuccess: (_, values) => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['group', values.group_id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'admin'] });
      toast.success('Assignment created successfully.');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create assignment.');
      setUploadProgress('idle');
    },
  });

  const errors = form.formState.errors;
  const isSubmitting = mutation.isPending;

  const progressLabel =
    uploadProgress === 'saving' ? 'Creating assignment…' : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100">
              <ClipboardList className="h-4.5 w-4.5 text-[#0052A5]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">Create Assignment</DialogTitle>
              <DialogDescription className="text-sm text-slate-400">
                Set up a new assignment task. Hidden from participants until the upload open time.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5 pt-1">

          {/* ── Group + Linked Class ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Group <span className="text-rose-500">*</span></Label>
              <Controller
                name="group_id"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!defaultGroupId}>
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="Select group" />
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

            <div className="space-y-1.5">
              <Label className="text-slate-700">Linked Class {defaultClassId ? '' : <span className="text-xs text-slate-400">(optional)</span>}</Label>
              <Controller
                name="class_id"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    disabled={!selectedGroupId || !!defaultClassId}
                  >
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {groupClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Sub-Group selector — only shown when group is selected and sub-groups exist */}
          {selectedGroupId && subGroups.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-slate-700 flex items-center gap-1.5">
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
                    <SelectTrigger className="bg-white border-slate-200">
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
              <p className="text-xs text-slate-400">
                Scope this assignment to a specific sub-batch, or leave as "All participants".
              </p>
            </div>
          )}

          {/* ── Title ───────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="a_title" className="text-slate-700">Title <span className="text-rose-500">*</span></Label>
            <Input id="a_title" {...form.register('title')} placeholder="e.g. Safety Report Assignment" className="bg-white border-slate-200" />
            {errors.title && <p className="text-xs text-rose-600">{errors.title.message}</p>}
          </div>

          {/* ── Question section ─────────────────────────────────────── */}
          <div className="rounded-xl border border-indigo-100 bg-blue-50/40 p-4 space-y-4">
            <p className="text-sm font-semibold text-[#0052A5]">Question</p>

            {/* Question document upload */}
            <div className="space-y-2">
              <Label className="text-slate-700 text-xs font-medium uppercase tracking-wide">Question Document <span className="text-slate-400 font-normal normal-case">(optional — PDF, Word, Excel, image, any format)</span></Label>
              {!pendingFile ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors px-4 py-3 ${
                    dragging
                      ? 'border-indigo-400 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 flex-shrink-0">
                    <Upload className="h-4 w-4 text-[#0066BB]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Drop a question file here or click to browse</p>
                    <p className="text-xs text-slate-400 mt-0.5">Question paper, worksheet, problem set — any format</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-white">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 flex-shrink-0">
                    <FileText className="h-4 w-4 text-[#0052A5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{pendingFile.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(pendingFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Written question text */}
            <div className="space-y-1.5">
              <Label htmlFor="question" className="text-slate-700 text-xs font-medium uppercase tracking-wide">Written Question <span className="text-rose-500">*</span></Label>
              <Textarea
                id="question"
                {...form.register('question')}
                rows={3}
                placeholder="Type the main assignment question here…"
                className="bg-white border-slate-200 resize-none"
              />
              {errors.question && <p className="text-xs text-rose-600">{errors.question.message}</p>}
            </div>
          </div>

          {/* ── Description ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="a_desc" className="text-slate-700">Description <span className="text-xs text-slate-400">(optional)</span></Label>
            <Textarea id="a_desc" {...form.register('description')} rows={2} placeholder="Additional context or background information…" className="bg-white border-slate-200 resize-none" />
          </div>

          {/* ── Instructions ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="instructions" className="text-slate-700">Instructions <span className="text-xs text-slate-400">(optional)</span></Label>
            <Textarea id="instructions" {...form.register('instructions')} rows={2} placeholder="Submission format, guidelines, rules…" className="bg-white border-slate-200 resize-none" />
          </div>

          {/* ── Upload open / Deadline ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="upload_open_at" className="text-slate-700">Upload Opens At</Label>
              <input
                id="upload_open_at"
                type="datetime-local"
                {...form.register('upload_open_at')}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
              />
              {errors.upload_open_at && <p className="text-xs text-rose-600">{errors.upload_open_at.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline_at" className="text-slate-700">Deadline <span className="text-rose-500">*</span></Label>
              <input
                id="deadline_at"
                type="datetime-local"
                {...form.register('deadline_at')}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
              />
              {errors.deadline_at && <p className="text-xs text-rose-600">{errors.deadline_at.message}</p>}
            </div>
          </div>

          {/* ── Late Policy ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-slate-700">Late Policy</Label>
            <div className="space-y-2">
              {LATE_POLICY_OPTIONS.map(opt => {
                const checked = form.watch('late_policy') === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'border-indigo-400 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      {...form.register('late_policy')}
                      className="mt-0.5 accent-indigo-600 flex-shrink-0"
                    />
                    <div>
                      <p className={`text-sm font-semibold leading-tight ${checked ? 'text-[#0052A5]' : 'text-slate-700'}`}>{opt.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.late_policy && <p className="text-xs text-rose-600">{errors.late_policy.message}</p>}
          </div>

          {/* ── Reminder Offsets ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-slate-700">Reminder Offsets <span className="text-xs text-slate-400">(minutes before deadline)</span></Label>
            <Controller
              name="reminder_offsets"
              control={form.control}
              render={({ field }) => (
                <ReminderOffsetsInput
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.reminder_offsets?.message}
                />
              )}
            />
          </div>

          {/* ── Upload progress ──────────────────────────────────────── */}
          {uploadProgress !== 'idle' && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-indigo-600 animate-spin flex-shrink-0" />
              <p className="text-sm font-medium text-[#0052A5]">{progressLabel}</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[160px]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {progressLabel || 'Creating…'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Create Assignment
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
