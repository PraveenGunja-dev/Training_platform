import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Network, Users, GraduationCap, UserCheck, Building2,
  ChevronDown, ChevronUp, Search, ShieldCheck, Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/features/charts/KpiCard';
import { ErrorState } from '@/components/states/ErrorState';
import { orgChartApi } from '@/api/orgChart';
import type { OrgChartPerson, OrgChartGroup, OrgChartSubGroup } from '@/api/orgChart';

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
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-[#E31837]/10" />

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

      <div className="relative z-10 space-y-1">
        <p className="text-white font-bold text-base leading-tight tracking-tight">{person.name}</p>
        <p className="text-blue-200 text-xs truncate max-w-[190px] opacity-80" title={person.email}>
          {person.email}
        </p>
      </div>

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

/* ── GroupHierarchyCard ───────────────────────────────────────────────── */
function GroupHierarchyCard({ group }: { group: OrgChartGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#0052A5] to-[#003F8A]" />

      {/* Group name */}
      <div className="px-4 py-3 bg-[#EBF3FB] border-b border-blue-100 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-[#0052A5] flex-shrink-0" />
        <span className="font-semibold text-[#00285A] text-sm truncate flex-1" title={group.name}>
          {group.name}
        </span>
        {group.is_archived && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 flex-shrink-0">Archived</Badge>
        )}
        {group.sub_groups.length > 0 && (
          <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
            <Layers className="h-2.5 w-2.5" />
            {group.sub_groups.length}
          </span>
        )}
      </div>

      {/* Group Admin */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-start gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-teal-600 block">
            Group Admin
          </span>
          {group.group_admin ? (
            <p className="text-xs text-slate-700 font-medium truncate" title={group.group_admin.email}>
              {group.group_admin.name}
            </p>
          ) : (
            <p className="text-xs text-slate-400 italic">Not assigned</p>
          )}
        </div>
      </div>

      {/* Instructors */}
      <div className="px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1 mb-1.5">
          <GraduationCap className="h-3 w-3 text-amber-600" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
            Instructors ({group.instructors.length})
          </span>
        </div>
        {group.instructors.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {group.instructors.map(inst => (
              <span
                key={inst.id}
                title={inst.email}
                className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded-full max-w-full truncate"
              >
                <span className="w-3 h-3 rounded-full bg-amber-200 text-amber-700 text-[7px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(inst.name)}
                </span>
                <span className="truncate">{inst.name}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No instructors assigned</p>
        )}
      </div>

      {/* Participant count + expand toggle */}
      <div className="px-4 py-2.5 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {group.participants.length} Participant{group.participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-slate-500 hover:text-[#0052A5] hover:bg-blue-50 gap-1"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? (
            <><ChevronUp className="h-3.5 w-3.5" />Hide</>
          ) : (
            <><ChevronDown className="h-3.5 w-3.5" />Show</>
          )}
        </Button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2.5 space-y-3">

          {/* Sub-groups */}
          {group.sub_groups.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                Sub-Groups ({group.sub_groups.length})
              </p>
              {group.sub_groups.map((sg: OrgChartSubGroup) => (
                <div key={sg.id} className="rounded-lg border border-violet-100 bg-violet-50/60 px-2.5 py-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-violet-700">{sg.name}</span>
                    <span className="text-[10px] text-violet-400">{sg.participants_count} members</span>
                  </div>
                  {sg.participants.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sg.participants.map(p => (
                        <span
                          key={p.id}
                          title={p.email}
                          className="inline-flex items-center gap-1 bg-white border border-violet-200
                            text-violet-800 text-[10px] font-medium px-1.5 py-0.5 rounded-full max-w-[130px] truncate"
                        >
                          <span className="w-3 h-3 rounded-full bg-violet-200 text-violet-700
                            text-[7px] font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(p.name)}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-violet-300 italic">No members</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Participants */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              All Participants
            </p>
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
        </div>
      )}
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */
function OrgChartSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border border-[#C5D8EC]" />)}
      </div>
      <div className="flex justify-center">
        <div className="h-40 w-56 bg-blue-100 rounded-2xl" />
      </div>
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-44 bg-slate-100 rounded-xl" />
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
        <p className="text-sm text-[#5A7A9A]">Super Admin → Groups → Instructors → Participants</p>
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

  /* Filter groups by search term */
  const filteredGroups = useMemo(() => {
    if (!orgData) return [];
    const q = search.toLowerCase();
    if (!search) return orgData.groups;
    return orgData.groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.group_admin?.name.toLowerCase().includes(q) ||
      g.instructors.some(i => i.name.toLowerCase().includes(q)) ||
      g.participants.some(p => p.name.toLowerCase().includes(q))
    );
  }, [orgData, search]);

  const filteredUnassigned = useMemo(() => {
    if (!orgData) return [];
    const q = search.toLowerCase();
    return orgData.unassigned_instructors.filter(p =>
      !search || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [orgData, search]);

  if (isLoading) return <div className="space-y-6"><PageHeader /><OrgChartSkeleton /></div>;
  if (isError) return (
    <div className="space-y-6">
      <PageHeader />
      <ErrorState title="Failed to load organisation chart" onRetry={() => void refetch()} />
    </div>
  );
  if (!orgData) return null;

  const hasResults = filteredGroups.length > 0 || filteredUnassigned.length > 0;

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <PageHeader />

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={<ShieldCheck   className="h-4 w-4" />} label="Super Admins"     value={orgData.stats.total_admins}       accent="indigo"  />
        <KpiCard icon={<ShieldCheck   className="h-4 w-4" />} label="Group Admins"     value={orgData.stats.total_group_admins} accent="teal"    />
        <KpiCard icon={<Building2     className="h-4 w-4" />} label="Groups"           value={orgData.stats.total_groups}       accent="cyan"    />
        <KpiCard icon={<Layers        className="h-4 w-4" />} label="Total Sub-Groups" value={orgData.stats.total_sub_groups}   accent="violet"  />
        <KpiCard icon={<GraduationCap className="h-4 w-4" />} label="Instructors"      value={orgData.stats.total_instructors}  accent="default" />
        <KpiCard icon={<Users         className="h-4 w-4" />} label="Participants"     value={orgData.stats.total_participants} accent="emerald" />
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#5A7A9A]" />
          <Input
            placeholder="Search groups, admins, instructors..."
            className="pl-8 h-9 text-sm border-[#C5D8EC] bg-[#EBF3FB]/40 focus:bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Hierarchy: Super Admin → Groups ─────────────────────────── */}
      <div className="overflow-x-auto pb-4">

        {/* Super Admin row */}
        <div className="flex justify-center mb-0">
          {orgData.admins.length > 0 ? (
            <div className="flex gap-4 flex-wrap justify-center">
              {orgData.admins.map(admin => <AdminCard key={admin.id} person={admin} />)}
            </div>
          ) : (
            <p className="text-sm text-[#5A7A9A] italic py-4">No administrators found.</p>
          )}
        </div>

        {/* Connector: vertical stem → horizontal bar → groups */}
        {hasResults && filteredGroups.length > 0 ? (
          <div className="relative">
            {/* Vertical stem from admin cards down */}
            <div
              className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-8"
              style={{ background: 'linear-gradient(to bottom, #0052A5, #E31837)' }}
            />

            {/* Horizontal bar */}
            {filteredGroups.length > 1 && (
              <div
                className="absolute top-8 h-0.5"
                style={{
                  left: '5%',
                  right: '5%',
                  background: 'linear-gradient(to right, #0052A5, #E31837, #0052A5)',
                }}
              />
            )}

            {/* Groups grid */}
            <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map(group => (
                <div key={group.id} className="flex flex-col items-stretch gap-0">
                  {/* Drop line to each card */}
                  <div className="flex justify-center">
                    <div
                      className="w-0.5 h-4"
                      style={{ background: 'linear-gradient(to bottom, #E31837, #0052A5)' }}
                    />
                  </div>
                  <GroupHierarchyCard group={group} />
                </div>
              ))}
            </div>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-blue-50 border border-blue-200 p-5">
              <Network className="h-10 w-10 text-blue-300" />
            </div>
            <h3 className="text-sm font-semibold text-[#00285A]">No results</h3>
            <p className="text-xs text-[#5A7A9A] mt-1">Try a different search term.</p>
          </div>
        ) : null}
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
