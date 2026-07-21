import { useQuery } from '@tanstack/react-query';
import {
  Users, FolderKanban, CalendarDays, AlertTriangle,
  CheckCircle, Clock, TrendingUp, BarChart2,
  PieChart, Activity, Bell,
} from 'lucide-react';
import { StaggerContainer } from '@/components/motion/StaggerContainer';
import { StaggerItem } from '@/components/motion/StaggerItem';
import { dashboardApi } from '@/api/dashboard';
import { KpiCard } from '@/features/charts/KpiCard';
import { ChartContainer } from '@/features/charts/ChartContainer';
import { AttendancePieChart } from '@/features/charts/AttendancePieChart';
import { WeeklyTrendChart, type WeeklyTrendPoint } from '@/features/admin/dashboard/WeeklyTrendChart';
import { ClassStatusChart, type ClassStatusPoint } from '@/features/admin/dashboard/ClassStatusChart';


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
          <KpiCard icon={<FolderKanban className="h-4 w-4" />} label="Total Batches"         value={d.kpis.total_groups}        accent="cyan"    />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<Activity className="h-4 w-4" />}     label="Classes Today"        value={d.kpis.classes_today}       accent="emerald" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={<CalendarDays className="h-4 w-4" />} label="Balance 2026"         value={d.kpis.classes_upcoming}    />
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



    </div>
  );
}
