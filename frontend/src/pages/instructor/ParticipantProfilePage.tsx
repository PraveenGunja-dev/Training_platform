import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, UserCircle, CheckCircle2, XCircle,
  BarChart3, ClipboardCheck, Briefcase, BadgeCheck, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { groupsApi } from '@/api/groups';
import { useAuthStore } from '@/store/auth';
import type { GroupParticipant } from '@/lib/types';

interface ProfileState {
  participant?: GroupParticipant;
  groupName?: string;
}

function StatCard({
  icon, label, value, good, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  good: boolean;
  color: { bg: string; border: string; good: string; bad: string; track: string; trackBad: string };
}) {
  return (
    <div className={`${color.bg} rounded-xl p-4 border ${color.border}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-slate-600">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${good ? color.good : color.bad}`}>
        {value}%
      </p>
      <div className="mt-2.5 h-2 bg-white/70 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${good ? color.track : color.trackBad}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className={`text-[11px] mt-1 ${good ? color.good : color.bad}`}>
        {good ? 'On track' : 'Needs attention'}
      </p>
    </div>
  );
}

export default function ParticipantProfilePage() {
  const { state } = useLocation() as { state: ProfileState | null };
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();

  const groupId = authUser?.admin_of_group_ids?.[0];

  // Fetch only when there's no state (direct URL / refresh)
  const { data: groupData, isLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupsApi.get(groupId!),
    enabled: !state?.participant && !!groupId,
    staleTime: 60_000,
  });

  const fromState = state?.participant;
  const fromApi   = groupData?.data?.participants?.find(p => p.id === id);
  const p         = fromState ?? (fromApi as GroupParticipant | undefined);
  const groupName = state?.groupName ?? groupData?.data?.name;

  if (isLoading && !p) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052A5]" />
        <p className="text-sm text-slate-500">Loading profile…</p>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <UserCircle className="h-12 w-12 text-slate-300" />
        <p className="text-sm text-slate-500">Participant info not available.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Go Back
        </Button>
      </div>
    );
  }

  const initials = (p.full_name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join('') || '?';

  const attendanceRate = p.attendance_rate ?? 0;
  const submissionRate = p.submission_rate ?? 0;
  const attendanceGood = attendanceRate >= 80;
  const submissionGood = submissionRate >= 80;

  return (
    <div className="space-y-6 max-w-2xl">

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-1"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />

        <div className="p-6 space-y-6">

          {/* Avatar + identity block */}
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-[#EBF3FB] border-2 border-[#D6E8F8] flex items-center justify-center text-[#0052A5] text-2xl font-bold shrink-0 select-none">
              {initials}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <h1 className="text-xl font-bold text-[#00285A] leading-tight">{p.full_name}</h1>

              {/* Email */}
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{p.email}</span>
              </div>

              {/* Emp Code + BU */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {p.employee_code ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <BadgeCheck className="h-3.5 w-3.5 text-[#0052A5] shrink-0" />
                    <span className="font-medium text-slate-500">Emp Code:</span>
                    <span className="font-semibold text-slate-700">{p.employee_code}</span>
                  </div>
                ) : null}
                {p.business_unit ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Briefcase className="h-3.5 w-3.5 text-[#0052A5] shrink-0" />
                    <span className="font-medium text-slate-500">Business Unit:</span>
                    <span className="font-semibold text-slate-700">{p.business_unit}</span>
                  </div>
                ) : null}
              </div>

              {/* Chips row */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {p.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                    <XCircle className="h-3 w-3" /> Inactive
                  </span>
                )}
                {groupName && (
                  <span className="text-xs text-[#0052A5] bg-[#EBF3FB] px-2.5 py-0.5 rounded-full border border-[#D6E8F8] font-medium">
                    {groupName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#EBF3FB]" />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={<BarChart3 className="h-4 w-4 text-[#0052A5]" />}
              label="Attendance Rate"
              value={attendanceRate}
              good={attendanceGood}
              color={{
                bg: 'bg-[#EBF3FB]', border: 'border-[#D6E8F8]',
                good: 'text-[#0052A5]', bad: 'text-amber-600',
                track: 'bg-[#0052A5]', trackBad: 'bg-amber-400',
              }}
            />
            <StatCard
              icon={<ClipboardCheck className="h-4 w-4 text-emerald-600" />}
              label="Submission Rate"
              value={submissionRate}
              good={submissionGood}
              color={{
                bg: 'bg-emerald-50', border: 'border-emerald-100',
                good: 'text-emerald-600', bad: 'text-amber-600',
                track: 'bg-emerald-500', trackBad: 'bg-amber-400',
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
