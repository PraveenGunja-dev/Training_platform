import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Network, Users, GraduationCap, UserCheck, Building2,
  ChevronDown, ChevronUp, Search, ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/features/charts/KpiCard';
import { ErrorState } from '@/components/states/ErrorState';
import { orgChartApi } from '@/api/orgChart';
import type { OrgChartPerson, OrgChartGroup } from '@/api/orgChart';

/* ── Helpers ──────────────────────────────────────────────────────────── */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* ── AdminCard ────────────────────────────────────────────────────────── */
function AdminCard({ person }: { person: OrgChartPerson }) {
  return (
    <div
      className="relative flex flex-col items-center gap-4 rounded-2xl px-8 py-6 w-64 text-center overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #001f4d 0%, #0052A5 45%, #003F8A 100%)',
        boxShadow: '0 8px 32px -4px rgba(0,82,165,0.45), 0 4px 12px -2px rgba(0,82,165,0.25)',
      }}
    >
      {/* Decorative circle blobs */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-[#E31837]/10" />

      {/* Avatar with glow ring */}
      <div className="relative z-10">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.10) 100%)',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.25), 0 0 0 6px rgba(255,255,255,0.08)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {getInitials(person.name)}
        </div>
      </div>

      {/* Text */}
      <div className="relative z-10 space-y-1">
        <p className="text-white font-bold text-base leading-tight tracking-tight">{person.name}</p>
        <p className="text-blue-200 text-xs truncate max-w-[190px] opacity-80" title={person.email}>
          {person.email}
        </p>
      </div>

      {/* Badge */}
      <div className="relative z-10">
        <span
          className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: 'linear-gradient(135deg, rgba(227,24,55,0.7) 0%, rgba(180,10,35,0.8) 100%)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Super Admin
        </span>
      </div>
    </div>
  );
}

/* ── InstructorCard ───────────────────────────────────────────────────── */
function InstructorCard({ person, groupCount }: { person: OrgChartPerson; groupCount: number }) {
  return (
    <div
      className="relative flex flex-col items-center gap-3 rounded-xl px-4 py-4 w-full text-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #3373BC 0%, #2868B0 40%, #B83348 80%, #CB3F52 100%)',
        boxShadow: '0 6px 24px -4px rgba(0,82,165,0.25), 0 2px 8px -2px rgba(227,24,55,0.12)',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/5" />
      <div className="absolute -bottom-3 -left-3 w-12 h-12 rounded-full bg-white/5" />

      {/* Avatar */}
      <div className="relative z-10">
        <div
          className="w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-bold text-base"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.12) 100%)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.30), 0 0 0 5px rgba(255,255,255,0.07)',
          }}
        >
          {getInitials(person.name)}
        </div>
      </div>

      {/* Text */}
      <div className="relative z-10 space-y-0.5 w-full px-1">
        <p className="text-white font-bold text-sm leading-tight truncate tracking-tight" title={person.name}>
          {person.name}
        </p>
        <p className="text-white/70 text-[11px] truncate" title={person.email}>{person.email}</p>
      </div>

      {/* Pills */}
      <div className="relative z-10 flex items-center gap-1.5 flex-wrap justify-center">
        <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/25">
          <GraduationCap className="h-2.5 w-2.5" />
          Instructor
        </span>
        <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/25">
          <Building2 className="h-2.5 w-2.5" />
          {groupCount} {groupCount === 1 ? 'group' : 'groups'}
        </span>
      </div>
    </div>
  );
}

/* ── GroupCard (compact, under instructor) ────────────────────────────── */
function GroupCard({ group }: { group: OrgChartGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#EBF3FB] border-b border-blue-100">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-3.5 w-3.5 text-[#0052A5] flex-shrink-0" />
          <span className="text-sm font-semibold text-[#00285A] truncate" title={group.name}>
            {group.name}
          </span>
          {group.is_archived && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 flex-shrink-0">Archived</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-1.5 py-0.5 rounded-full">
            <Users className="h-2.5 w-2.5" />
            {group.participants.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-slate-400 hover:text-[#0052A5] hover:bg-blue-50 rounded"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Participants */}
      {expanded && (
        <div className="px-3 py-2.5">
          {group.participants.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {group.participants.map(p => (
                <span
                  key={p.id}
                  title={p.email}
                  className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200
                    text-emerald-800 text-[11px] font-medium px-2 py-0.5 rounded-full max-w-[150px] truncate"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-200 text-emerald-700
                    text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(p.name)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No participants</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── InstructorColumn ─────────────────────────────────────────────────── */
function InstructorColumn({
  instructor,
  groups,
}: {
  instructor: OrgChartPerson;
  groups: OrgChartGroup[];
}) {
  return (
    <div className="flex flex-col items-stretch gap-0 min-w-0 px-3">
      {/* Vertical drop from horizontal bar → instructor card */}
      <div className="flex justify-center">
        <div
          className="w-0.5 h-7"
          style={{ background: 'linear-gradient(to bottom, #E31837, #0052A5)' }}
        />
      </div>

      {/* Instructor card */}
      <InstructorCard person={instructor} groupCount={groups.length} />

      {/* Vertical connector instructor card → groups */}
      {groups.length > 0 && (
        <div className="flex justify-center">
          <div
            className="w-0.5 h-5"
            style={{ background: 'linear-gradient(to bottom, #0052A5, #003F8A)' }}
          />
        </div>
      )}

      {/* Group cards */}
      {groups.length > 0 && (
        <div className="flex flex-col gap-2">
          {groups.map(g => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */
function OrgChartSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border border-[#C5D8EC]" />)}
      </div>
      <div className="flex justify-center">
        <div className="h-40 w-56 bg-blue-100 rounded-2xl" />
      </div>
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-28 bg-amber-100 rounded-xl" />
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="h-12 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Page header ──────────────────────────────────────────────────────── */
function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
        <Network className="h-5 w-5 text-[#0052A5]" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#00285A] leading-tight">Organisation Hierarchy</h1>
        <p className="text-sm text-[#5A7A9A]">Super Admin → Instructors → Groups → Participants</p>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function AdminOrgChartPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'org-chart'],
    queryFn: orgChartApi.get,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const orgData = data?.data;

  /* Build instructor → groups map */
  const instructorColumns = useMemo(() => {
    if (!orgData) return [];
    const map = new Map<string, { instructor: OrgChartPerson; groups: OrgChartGroup[] }>();
    for (const group of orgData.groups) {
      for (const inst of group.instructors) {
        if (!map.has(inst.id)) map.set(inst.id, { instructor: inst, groups: [] });
        map.get(inst.id)!.groups.push(group);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.instructor.name.localeCompare(b.instructor.name)
    );
  }, [orgData]);

  /* Filter */
  const q = search.toLowerCase();
  const filteredColumns = instructorColumns.map(col => ({
    ...col,
    groups: col.groups.filter(g =>
      search === '' ||
      g.name.toLowerCase().includes(q) ||
      col.instructor.name.toLowerCase().includes(q) ||
      g.participants.some(p => p.name.toLowerCase().includes(q))
    ),
  })).filter(col =>
    search === '' ||
    col.instructor.name.toLowerCase().includes(q) ||
    col.groups.length > 0
  );

  const filteredUnassigned = (orgData?.unassigned_instructors ?? []).filter(p =>
    search === '' || p.name.toLowerCase().includes(q)
  );

  if (isLoading) return <div className="space-y-6"><PageHeader /><OrgChartSkeleton /></div>;
  if (isError) return (
    <div className="space-y-6">
      <PageHeader />
      <ErrorState title="Failed to load organisation chart" onRetry={() => void refetch()} />
    </div>
  );
  if (!orgData) return null;

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <PageHeader />

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<ShieldCheck className="h-4 w-4" />} label="Super Admins"  value={orgData.stats.total_admins}        accent="indigo"  />
        <KpiCard icon={<Building2    className="h-4 w-4" />} label="Groups"        value={orgData.stats.total_groups}        accent="cyan"    />
        <KpiCard icon={<GraduationCap className="h-4 w-4" />} label="Instructors"  value={orgData.stats.total_instructors}   accent="default" />
        <KpiCard icon={<Users         className="h-4 w-4" />} label="Participants"  value={orgData.stats.total_participants}  accent="emerald" />
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#5A7A9A]" />
          <Input
            placeholder="Search instructors, groups, participants..."
            className="pl-8 h-9 text-sm border-[#C5D8EC] bg-[#EBF3FB]/40 focus:bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tree: Admin → Instructors → Groups → Participants ───────── */}
      <div className="overflow-x-auto pb-4">

        {/* Admin row */}
        <div className="flex justify-center mb-0">
          {orgData.admins.length > 0 ? (
            <div className="flex gap-4 flex-wrap justify-center">
              {orgData.admins.map(admin => <AdminCard key={admin.id} person={admin} />)}
            </div>
          ) : (
            <p className="text-sm text-[#5A7A9A] italic py-4">No administrators found.</p>
          )}
        </div>

        {/* Vertical stem + horizontal bar + instructor columns — single relative wrapper, no gap */}
        {filteredColumns.length > 0 ? (
          <div className="relative">
            {/* Vertical stem: admin card → horizontal bar (top-0 to top-8) */}
            <div
              className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-8"
              style={{ background: 'linear-gradient(to bottom, #0052A5, #E31837)' }}
            />

            {/* Horizontal bar at exactly top-8, matching the stem's bottom edge */}
            {filteredColumns.length > 1 && (
              <div
                className="absolute top-8 h-0.5 animate-gradient-x"
                style={{
                  left:  `calc(100% / ${filteredColumns.length * 2})`,
                  right: `calc(100% / ${filteredColumns.length * 2})`,
                  background: 'linear-gradient(to right, #0052A5, #E31837, #0052A5)',
                  backgroundSize: '200% 100%',
                }}
              />
            )}

            {/* Grid — no gap so column centres align exactly with the horizontal bar formula */}
            <div
              className="grid items-start pt-8"
              style={{ gridTemplateColumns: `repeat(${Math.min(filteredColumns.length, 4)}, minmax(0, 1fr))` }}
            >
              {filteredColumns.map(col => (
                <InstructorColumn
                  key={col.instructor.id}
                  instructor={col.instructor}
                  groups={col.groups}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-blue-50 border border-blue-200 p-5">
              <Network className="h-10 w-10 text-blue-300" />
            </div>
            <h3 className="text-sm font-semibold text-[#00285A]">No results</h3>
            <p className="text-xs text-[#5A7A9A] mt-1">Try a different search term.</p>
          </div>
        )}
      </div>

      {/* ── Unassigned instructors ───────────────────────────────────── */}
      {filteredUnassigned.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-blue-200" />
            <span className="text-xs font-bold tracking-widest uppercase text-[#0052A5] px-1">
              Unassigned Instructors
            </span>
            <div className="h-px flex-1 bg-blue-200" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="h-4 w-4 text-[#0052A5]" />
              <p className="text-xs text-[#0052A5] font-medium">
                {filteredUnassigned.length} instructor{filteredUnassigned.length !== 1 ? 's' : ''} not yet assigned to any group
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredUnassigned.map(inst => (
                <span
                  key={inst.id}
                  title={inst.email}
                  className="inline-flex items-center gap-2 bg-white border border-blue-200
                    text-[#00285A] text-sm font-medium px-3 py-1.5 rounded-full shadow-sm"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0052A5] text-[9px]
                    font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(inst.name)}
                  </span>
                  {inst.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
