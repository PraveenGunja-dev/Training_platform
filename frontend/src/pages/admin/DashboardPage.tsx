import { useQuery } from '@tanstack/react-query';
import {
  Users, FolderKanban, CalendarDays, AlertTriangle,
  CheckCircle, Clock, TrendingUp, BarChart2,
  PieChart, Activity, FileText, Bell,
} from 'lucide-react';
import { StaggerContainer } from '@/components/motion/StaggerContainer';
import { StaggerItem } from '@/components/motion/StaggerItem';
import { dashboardApi } from '@/api/dashboard';
import { KpiCard } from '@/features/charts/KpiCard';
import { ChartContainer } from '@/features/charts/ChartContainer';
import { AttendancePieChart } from '@/features/charts/AttendancePieChart';
import { SubmissionBarChart } from '@/features/charts/SubmissionBarChart';
import { GroupComparisonChart } from '@/features/admin/dashboard/GroupComparisonChart';
import { DailyUploadTrendChart } from '@/features/admin/dashboard/DailyUploadTrendChart';
import { DeadlineTrackingChart } from '@/features/admin/dashboard/DeadlineTrackingChart';
import { WeeklyTrendChart, type WeeklyTrendPoint } from '@/features/admin/dashboard/WeeklyTrendChart';
import { ClassStatusChart, type ClassStatusPoint } from '@/features/admin/dashboard/ClassStatusChart';
import { ParticipantActivityTable } from '@/features/admin/dashboard/ParticipantActivityTable';
import { formatRelative } from '@/lib/dates';
import type { DashboardActivityEntry } from '@/api/dashboard';

function ActivityFeed({ entries }: { entries: DashboardActivityEntry[] }) {
  if (!entries.length) {
    return <p className="text-xs text-[#5A7A9A] text-center py-6">No recent activity.</p>;
  }
  return (
    <ul className="space-y-3">
      {entries.map(e => (
        <li key={e.id} className="flex items-start gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-[#00285A]">{e.actor_name}</span>
            <span className="text-xs text-[#7C7AAE]"> · {e.action.replace(/\./g, ' ')}</span>
            <p className="text-[11px] text-[#5A7A9A] mt-0.5">{formatRelative(e.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-[#C5D8EC] rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border border-[#C5D8EC]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <div key={i} className="h-72 bg-white rounded-2xl border border-[#C5D8EC]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => <div key={i} className="h-72 bg-white rounded-2xl border border-[#C5D8EC]" />)}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => dashboardApi.admin(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;
  const d = data?.data;
  if (!d) return null;

  const charts        = d.charts as Record<string, unknown[]>;
  const weeklyTrend   = (charts.weekly_trend  ?? []) as WeeklyTrendPoint[];
  const classStatus   = (charts.class_status  ?? []) as ClassStatusPoint[];

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
          <BarChart2 className="h-5 w-5 text-[#0052A5]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#00285A] leading-tight">System Dashboard</h1>
          <p className="text-sm text-[#5A7A9A]">Real-time overview across all groups</p>
        </div>
      </div>

      {/* ── Row 1: KPI cards ─────────────────────────────────────────── */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StaggerItem>
          <KpiCard icon={<Users className="h-4 w-4" />}        label="Total Participants"  value={d.kpis.total_participants}  accent="indigo"  />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<FolderKanban className="h-4 w-4" />} label="Class Groups"         value={d.kpis.total_groups}        accent="cyan"    />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<Activity className="h-4 w-4" />}     label="Classes Today"        value={d.kpis.classes_today}       accent="emerald" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<CalendarDays className="h-4 w-4" />} label="Upcoming Classes"     value={d.kpis.classes_upcoming}    />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<CheckCircle className="h-4 w-4" />}  label="Submitted"            value={d.kpis.submitted}           accent="emerald" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<Clock className="h-4 w-4" />}        label="Pending"              value={d.kpis.pending}             />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<AlertTriangle className="h-4 w-4" />}label="Late Submissions"     value={d.kpis.late}                accent="rose"    />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<Bell className="h-4 w-4" />}         label="Pending Approvals"    value={d.kpis.pending_approvals}   accent="amber"   />
        </StaggerItem>
      </StaggerContainer>

      {/* ── Row 2: Attendance donut + Class status donut + Weekly trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <StaggerContainer>
          <StaggerItem>
            <ChartContainer
              title="Attendance Today"
              subtitle="Present / Absent / Late breakdown"
              icon={<PieChart className="h-3.5 w-3.5" />}
            >
              <AttendancePieChart data={d.charts.attendance_pie} />
            </ChartContainer>
          </StaggerItem>
        </StaggerContainer>

        <StaggerContainer>
          <StaggerItem>
            <ChartContainer
              title="Class Status"
              subtitle="Completed · Upcoming · Ongoing"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            >
              <ClassStatusChart data={classStatus} />
            </ChartContainer>
          </StaggerItem>
        </StaggerContainer>

        <StaggerContainer>
          <StaggerItem>
            <ChartContainer
              title="4-Week Trend"
              subtitle="Attendance & submission rates week-on-week"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            >
              <WeeklyTrendChart data={weeklyTrend} />
            </ChartContainer>
          </StaggerItem>
        </StaggerContainer>
      </div>

      {/* ── Row 3: Submissions bar + Group comparison ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartContainer
          title="Submissions by Group"
          subtitle="Submitted · Pending · Late"
          icon={<FileText className="h-3.5 w-3.5" />}
        >
          <SubmissionBarChart data={d.charts.submission_bar} />
        </ChartContainer>

        <ChartContainer
          title="Group-wise Performance"
          subtitle="Attendance % vs Submission %"
          icon={<BarChart2 className="h-3.5 w-3.5" />}
        >
          <GroupComparisonChart data={d.charts.group_comparison} />
        </ChartContainer>
      </div>

      {/* ── Row 4: Upload trend + Deadlines + Activity ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartContainer
          title="Daily Upload Trend"
          subtitle="Last 14 days"
          icon={<Activity className="h-3.5 w-3.5" />}
        >
          <DailyUploadTrendChart data={d.charts.daily_upload_trend} />
        </ChartContainer>

        <ChartContainer
          title="Upcoming Deadlines"
          subtitle="Pending submissions per task"
          icon={<Clock className="h-3.5 w-3.5" />}
        >
          <DeadlineTrackingChart data={d.charts.deadline_tracking} />
        </ChartContainer>

        {/* Recent activity feed */}
        <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-[#0066BB]">
              <Bell className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#00285A] leading-tight">Recent Activity</p>
              <p className="text-xs text-[#5A7A9A] mt-0.5">Latest system events</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <ActivityFeed entries={d.recent_activity} />
          </div>
        </div>
      </div>

      {/* ── Row 5: Participant table ──────────────────────────────────── */}
      <ChartContainer
        title="Participant Activity"
        subtitle="Individual attendance & submission rates"
        icon={<Users className="h-3.5 w-3.5" />}
      >
        <ParticipantActivityTable data={d.participant_activity ?? []} totalParticipants={d.kpis.total_participants} />
      </ChartContainer>

    </div>
  );
}
