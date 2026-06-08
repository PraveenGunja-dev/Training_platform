import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, Users, Plus, Calendar, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { groupsApi } from '@/api/groups';
import { formatDate } from '@/lib/dates';
import { ErrorState } from '@/components/states/ErrorState';
import type { ClassGroup } from '@/lib/types';

/* ── Card colour palette (light, professional) ──────────────────────── */
const PALETTE = [
  {
    accent:    'bg-blue-500',
    border:    'border-blue-100',
    hoverRing: 'hover:ring-blue-200',
    initBg:    'bg-blue-100',
    initText:  'text-blue-700',
    iconColor: 'text-blue-400',
    chipBg:    'bg-blue-50 text-blue-700',
  },
  {
    accent:    'bg-violet-500',
    border:    'border-violet-100',
    hoverRing: 'hover:ring-violet-200',
    initBg:    'bg-violet-100',
    initText:  'text-violet-700',
    iconColor: 'text-violet-400',
    chipBg:    'bg-violet-50 text-violet-700',
  },
  {
    accent:    'bg-emerald-500',
    border:    'border-emerald-100',
    hoverRing: 'hover:ring-emerald-200',
    initBg:    'bg-emerald-100',
    initText:  'text-emerald-700',
    iconColor: 'text-emerald-400',
    chipBg:    'bg-emerald-50 text-emerald-700',
  },
  {
    accent:    'bg-amber-500',
    border:    'border-amber-100',
    hoverRing: 'hover:ring-amber-200',
    initBg:    'bg-amber-100',
    initText:  'text-amber-700',
    iconColor: 'text-amber-400',
    chipBg:    'bg-amber-50 text-amber-700',
  },
  {
    accent:    'bg-rose-500',
    border:    'border-rose-100',
    hoverRing: 'hover:ring-rose-200',
    initBg:    'bg-rose-100',
    initText:  'text-rose-700',
    iconColor: 'text-rose-400',
    chipBg:    'bg-rose-50 text-rose-700',
  },
  {
    accent:    'bg-teal-500',
    border:    'border-teal-100',
    hoverRing: 'hover:ring-teal-200',
    initBg:    'bg-teal-100',
    initText:  'text-teal-700',
    iconColor: 'text-teal-400',
    chipBg:    'bg-teal-50 text-teal-700',
  },
  {
    accent:    'bg-orange-500',
    border:    'border-orange-100',
    hoverRing: 'hover:ring-orange-200',
    initBg:    'bg-orange-100',
    initText:  'text-orange-700',
    iconColor: 'text-orange-400',
    chipBg:    'bg-orange-50 text-orange-700',
  },
  {
    accent:    'bg-blue-500',
    border:    'border-indigo-100',
    hoverRing: 'hover:ring-indigo-200',
    initBg:    'bg-blue-100',
    initText:  'text-[#0052A5]',
    iconColor: 'text-blue-400',
    chipBg:    'bg-blue-50 text-[#0052A5]',
  },
] as const;

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* ── Group card ─────────────────────────────────────────────────────── */
function GroupCard({ group, index, onClick }: { group: ClassGroup; index: number; onClick: () => void }) {
  const p = PALETTE[index % PALETTE.length];
  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-2xl border ${p.border} ring-1 ring-transparent ${p.hoverRing} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden group`}
    >
      {/* Coloured top accent bar */}
      <div className={`h-1.5 ${p.accent}`} />

      <div className="p-5">
        {/* Header: avatar + name + archived badge */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${p.initBg} flex items-center justify-center shrink-0 text-sm font-bold ${p.initText}`}>
            {getInitials(group.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-1">
                {group.name}
              </h3>
              {group.is_archived && (
                <Badge variant="secondary" className="text-xs shrink-0 py-0">Archived</Badge>
              )}
            </div>
            {group.description ? (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                {group.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5 italic">No description</p>
            )}
          </div>
          {/* Arrow chevron — visible on hover */}
          <ArrowRight className={`h-4 w-4 ${p.iconColor} opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5`} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${p.chipBg}`}>
            <Users className="h-3 w-3" />
            {group.participants_count} participant{group.participants_count !== 1 ? 's' : ''}
          </span>
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="h-3 w-3" />
            {formatDate(group.created_at, 'dd MMM yyyy')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Create dialog ──────────────────────────────────────────────────── */
const createGroupSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

function CreateGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateGroupForm) => groupsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-foreground/90">Group Name</label>
            <Input
              {...register('name')}
              placeholder="e.g. Safety Induction Batch C"
              className="mt-1"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/90">Description (optional)</label>
            <Input
              {...register('description')}
              placeholder="Brief description of this group"
              className="mt-1"
            />
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-500">Failed to create group. Please try again.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AdminGroupsPage() {
  const navigate    = useNavigate();
  const [search, setSearch]           = useState('');
  const [instructorFilter, setInstructorFilter] = useState('ALL');
  const [createOpen, setCreateOpen]   = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['groups', 'admin'],
    queryFn:  () => groupsApi.list({ is_archived: false }),
  });

  const allGroups = data?.data ?? [];

  const instructorOptions = Array.from(
    new Map(
      allGroups.flatMap(g => g.instructors ?? []).map(i => [i.id, i.full_name])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const groups = allGroups
    .filter(g => search === '' || g.name.toLowerCase().includes(search.toLowerCase()))
    .filter(g =>
      instructorFilter === 'ALL' ||
      (g.instructors ?? []).some(i => i.id === instructorFilter)
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.data.length} group${data.data.length !== 1 ? 's' : ''} in the system` : 'All class groups in the system.'}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Group
        </Button>
      </div>

      {/* Search + Instructor filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Search groups..."
            className="pl-8 w-56"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={instructorFilter} onValueChange={setInstructorFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Instructors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Instructors</SelectItem>
            {instructorOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {instructorFilter !== 'ALL' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInstructorFilter('ALL')}
            className="text-xs h-9 px-3 border-slate-300 text-slate-600 hover:text-slate-900"
          >
            ✕ Clear filter
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse" aria-busy="true">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Failed to load groups" onRetry={() => void refetch()} />
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground/70">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {(data?.data ?? []).length === 0
              ? 'No groups yet. Create the first one.'
              : 'No groups match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group, idx) => (
            <GroupCard
              key={group.id}
              group={group}
              index={idx}
              onClick={() => navigate(`/admin/groups/${group.id}`)}
            />
          ))}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
