import { useQuery } from '@tanstack/react-query';
import {
  Users, GraduationCap, Layers, CalendarDays,
  CheckCircle, Clock, AlertTriangle, BarChart2,
  PieChart, TrendingUp, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { dashboardApi } from '@/api/dashboard';
import { KpiCard } from '@/features/charts/KpiCard';
import { ChartContainer } from '@/features/charts/ChartContainer';
import { AttendancePieChart } from '@/features/charts/AttendancePieChart';
import { ClassStatusChart, type ClassStatusPoint } from '@/features/admin/dashboard/ClassStatusChart';
import { WeeklyTrendChart, type WeeklyTrendPoint } from '@/features/admin/dashboard/WeeklyTrendChart';
import { DeadlineTrackingChart } from '@/features/admin/dashboard/DeadlineTrackingChart';
import { ParticipantActivityTable } from '@/features/admin/dashboard/ParticipantActivityTable';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-6">
      <div className="h-8 w-56 bg-teal-100 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border border-teal-100" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <div key={i} className="h-72 bg-white rounded-2xl border border-teal-100" />)}
      </div>
    </div>
  );
}

export default function GroupAdminDashboardPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'group-admin'],
    queryFn: () => dashboardApi.groupAdmin(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;
  const d = data?.data;
  if (!d) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
      <p className="text-sm font-medium">No dashboard data available.</p>
      <p className="text-xs mt-1 text-slate-400">
        Make sure you are assigned as a group admin and your group has activity.
      </p>
    </div>
  );

  const classStatus = d.charts.class_status as ClassStatusPoint[];
  const weeklyTrend = d.charts.weekly_trend as WeeklyTrendPoint[];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100">
          <BarChart2 className="h-5 w-5 text-teal-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Welcome, {user?.full_name}
          </h1>
          <p className="text-sm text-slate-500">
            Managing: <span className="font-medium text-teal-700">{d.group_name}</span>
          </p>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="h-4 w-4" />}         label="Participants"      value={d.kpis.total_participants}  accent="indigo"  />
        <KpiCard icon={<GraduationCap className="h-4 w-4" />} label="Instructors"       value={d.kpis.total_instructors}   accent="cyan"    />
        <KpiCard icon={<Layers className="h-4 w-4" />}        label="Sub-Groups"        value={d.kpis.total_sub_groups}    accent="violet"  />
        <KpiCard icon={<FileText className="h-4 w-4" />}      label="Total Assignments" value={d.kpis.total_assignments}              />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<CalendarDays className="h-4 w-4" />}  label="Classes Today"    value={d.kpis.classes_today}      accent="emerald" />
        <KpiCard icon={<Clock className="h-4 w-4" />}         label="Upcoming Classes" value={d.kpis.classes_upcoming}                   />
        <KpiCard icon={<CheckCircle className="h-4 w-4" />}   label="Submitted"        value={d.kpis.submitted}          accent="emerald" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Late Submissions" value={d.kpis.late}               accent="rose"    />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartContainer
          title="Attendance (Last 30 Days)"
          subtitle="Present vs Absent"
          icon={<PieChart className="h-3.5 w-3.5" />}
        >
          <AttendancePieChart data={d.charts.attendance_pie} />
        </ChartContainer>

        <ChartContainer
          title="Class Status"
          subtitle="Completed · Upcoming · Ongoing"
          icon={<CalendarDays className="h-3.5 w-3.5" />}
        >
          <ClassStatusChart data={classStatus} />
        </ChartContainer>

        <ChartContainer
          title="4-Week Trend"
          subtitle="Attendance & submission rates week-on-week"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        >
          <WeeklyTrendChart data={weeklyTrend} />
        </ChartContainer>
      </div>

      {/* Deadline tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartContainer
          title="Upcoming Deadlines"
          subtitle="Pending submissions per assignment"
          icon={<Clock className="h-3.5 w-3.5" />}
        >
          <DeadlineTrackingChart data={d.charts.deadline_tracking} />
        </ChartContainer>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Assignment Summary</p>
            <p className="text-xs text-slate-400 mt-0.5">Submissions breakdown for your group</p>
          </div>
          <div className="p-5 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{d.kpis.submitted}</p>
              <p className="text-xs text-slate-500 mt-1">Submitted</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{d.kpis.pending}</p>
              <p className="text-xs text-slate-500 mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-rose-500">{d.kpis.late}</p>
              <p className="text-xs text-slate-500 mt-1">Late</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="text-xs text-slate-400 mb-1.5 flex justify-between">
              <span>Total assignments: {d.kpis.total_assignments}</span>
              <span>{d.kpis.total_participants} participants</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
              {d.kpis.total_assignments > 0 && d.kpis.total_participants > 0 ? (() => {
                const total = d.kpis.total_assignments * d.kpis.total_participants;
                const subPct = Math.round((d.kpis.submitted / total) * 100);
                const latePct = Math.round((d.kpis.late / total) * 100);
                const pendPct = Math.max(0, 100 - subPct - latePct);
                return (
                  <>
                    <div className="bg-emerald-500 h-full" style={{ width: `${subPct}%` }} />
                    <div className="bg-rose-400 h-full" style={{ width: `${latePct}%` }} />
                    <div className="bg-amber-300 h-full" style={{ width: `${pendPct}%` }} />
                  </>
                );
              })() : <div className="bg-slate-200 h-full w-full" />}
            </div>
          </div>
        </div>
      </div>

      {/* Participant activity */}
      <ChartContainer
        title="Participant Activity"
        subtitle="Individual attendance & submission rates"
        icon={<Users className="h-3.5 w-3.5" />}
      >
        <ParticipantActivityTable data={d.participant_activity} />
      </ChartContainer>
    </div>
  );
}
