import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, Users, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { instructorApi, type InstructorGroup } from '@/api/instructor';
import { ErrorState } from '@/components/states/ErrorState';

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

/* ── Group card (adapted for InstructorGroup) ───────────────────────── */
function GroupCard({ group, index, onClick }: { group: InstructorGroup; index: number; onClick: () => void }) {
  const p = PALETTE[index % PALETTE.length];
  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-2xl border ${p.border} ring-1 ring-transparent ${p.hoverRing} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden group`}
    >
      {/* Coloured top accent bar */}
      <div className={`h-1.5 ${p.accent}`} />

      <div className="p-5">
        {/* Header: avatar + name */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${p.initBg} flex items-center justify-center shrink-0 text-sm font-bold ${p.initText}`}>
            {getInitials(group.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-1">
              {group.name}
            </h3>
          </div>
          {/* Arrow chevron — visible on hover */}
          <ArrowRight className={`h-4 w-4 ${p.iconColor} opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5`} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${p.chipBg}`}>
            <Users className="h-3 w-3" />
            {group.participant_count} participant{group.participant_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function InstructorGroupsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['instructor', 'my-groups'],
    queryFn: () => instructorApi.myGroups(),
    staleTime: 60_000,
  });

  const allGroups = data?.data ?? [];
  const groups = allGroups.filter(
    g => search === '' || g.name.toLowerCase().includes(search.toLowerCase()),
  );
  const N = allGroups.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assigned Groups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data
            ? `${N} group${N !== 1 ? 's' : ''} assigned to you`
            : 'Your assigned class groups.'}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
        <Input
          placeholder="Search groups..."
          className="pl-8"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
            {allGroups.length === 0
              ? 'No groups assigned yet. Please contact an admin.'
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
              onClick={() => navigate(`/instructor/groups/${group.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
