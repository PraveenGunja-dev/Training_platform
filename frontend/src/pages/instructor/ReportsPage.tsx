import { useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import { dashboardApi } from '@/api/dashboard';
import { instructorApi } from '@/api/instructor';
import { ChartContainer } from '@/features/charts/ChartContainer';
import { AttendancePieChart } from '@/features/charts/AttendancePieChart';
import { SubmissionBarChart } from '@/features/charts/SubmissionBarChart';
import { WeeklyTrendChart, type WeeklyTrendPoint } from '@/features/admin/dashboard/WeeklyTrendChart';
import { DeadlineTrackingChart } from '@/features/admin/dashboard/DeadlineTrackingChart';
import { GroupComparisonChart } from '@/features/admin/dashboard/GroupComparisonChart';
import { ParticipantActivityTable } from '@/features/admin/dashboard/ParticipantActivityTable';

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    </div>
  );
}

export default function InstructorReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'instructor'],
    queryFn: () => dashboardApi.admin(),
    staleTime: 60_000,
  });

  const { data: myGroupsData } = useQuery({
    queryKey: ['instructor', 'my-groups'],
    queryFn: () => instructorApi.myGroups(),
    staleTime: 120_000,
  });

  const effectiveCanViewAll = myGroupsData?.effective_can_view_all ?? false;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
          <BarChart2 className="h-5 w-5 text-[#0052A5]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Reports</h1>
          <p className="text-sm text-slate-500">Analytics scoped to your assigned groups.</p>
        </div>
      </div>
      <ReportsSkeleton />
    </div>
  );

  const d = data?.data;
  if (!d) return null;

  const charts = d.charts;
  const weeklyTrend = (charts.weekly_trend ?? []) as WeeklyTrendPoint[];

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
          <BarChart2 className="h-5 w-5 text-[#0052A5]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Reports</h1>
          <p className="text-sm text-slate-500">
            {effectiveCanViewAll
              ? 'Showing analytics across all groups.'
              : 'Analytics scoped to your assigned groups.'}
          </p>
          {effectiveCanViewAll && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#0052A5] border border-blue-200 mt-1">
              Showing all groups (read-only beyond yours)
            </span>
          )}
        </div>
      </div>

      {/* Row 1: Attendance pie + weekly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Attendance Today" subtitle="Present / absent breakdown">
          <AttendancePieChart data={charts.attendance_pie ?? []} />
        </ChartContainer>
        <ChartContainer title="4-Week Trend" subtitle="Attendance and submission rates over time">
          <WeeklyTrendChart data={weeklyTrend} />
        </ChartContainer>
      </div>

      {/* Row 2: Submissions + group comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Submissions by Group" subtitle="Submitted, pending, and late counts">
          <SubmissionBarChart data={charts.submission_bar ?? []} />
        </ChartContainer>
        <ChartContainer title="Group Performance" subtitle="Attendance and submission rates per group">
          <GroupComparisonChart data={charts.group_comparison ?? []} />
        </ChartContainer>
      </div>

      {/* Row 3: Deadlines + participant activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Upcoming Deadlines" subtitle="Assignments due soon">
          <DeadlineTrackingChart data={charts.deadline_tracking ?? []} />
        </ChartContainer>
        <ChartContainer title="Participant Activity" subtitle="Attendance and submission rates per participant">
          <ParticipantActivityTable data={d.participant_activity ?? []} />
        </ChartContainer>
      </div>
    </div>
  );
}
