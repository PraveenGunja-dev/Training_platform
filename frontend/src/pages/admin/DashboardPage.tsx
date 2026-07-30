import { useState } from 'react';
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
import {
  BatchBreakdownPopover,
  type BreakdownRow,
} from '@/features/admin/dashboard/BatchBreakdownPopover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


// ── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-[#C5D8EC] rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-xl border border-[#C5D8EC]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-72 bg-white rounded-2xl border border-[#C5D8EC]" />
        ))}
      </div>
    </div>
  );
}


// ── Page component ────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Main KPI + chart query — re-runs whenever selectedGroupId changes
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'admin', selectedGroupId],
    queryFn: () =>
      dashboardApi.admin(selectedGroupId ? { group_id: selectedGroupId } : undefined),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 60_000,
  });

  // Breakdown query — always overall; used for batch selector options + popovers
  const { data: breakdownData, isLoading: breakdownLoading } = useQuery({
    queryKey: ['dashboard', 'admin', 'breakdown'],
    queryFn: () => dashboardApi.breakdown(),
    staleTime: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;
  const d = data?.data;
  if (!d) return null;

  const charts      = d.charts as Record<string, unknown[]>;
  const weeklyTrend = (charts.weekly_trend ?? []) as WeeklyTrendPoint[];
  const classStatus = (charts.class_status  ?? []) as ClassStatusPoint[];

  // ── Breakdown data ────────────────────────────────────────────────────────
  const bd                = breakdownData?.data?.breakdown ?? [];
  const attendanceByBatch = breakdownData?.data?.attendance_by_batch ?? [];

  const isFiltered  = selectedGroupId !== null;
  const noBreakdown = breakdownLoading || bd.length === 0;
  // Popovers only shown in Overall mode with data loaded
  const noPopover   = noBreakdown || isFiltered;

  const selectedBatchName = isFiltered
    ? (bd.find(b => b.group_id === selectedGroupId)?.group_name ?? 'Selected Batch')
    : null;

  // ── KPI popover rows ──────────────────────────────────────────────────────
  const totalSubmitted   = bd.reduce((s, b) => s + b.submitted, 0);
  const totalAssignments = bd.reduce((s, b) => s + b.submitted + b.pending + b.late_submissions, 0);

  const participantRows: BreakdownRow[] = bd.map(b => ({
    group_id: b.group_id, group_name: b.group_name, value: b.participants_count,
  }));

  const classesTodayRows: BreakdownRow[] = bd
    .filter(b => b.classes_today > 0)
    .map(b => ({ group_id: b.group_id, group_name: b.group_name, value: b.classes_today }));

  const upcomingRows: BreakdownRow[] = bd.map(b => ({
    group_id: b.group_id, group_name: b.group_name, value: b.classes_upcoming,
  }));

  const submittedRows: BreakdownRow[] = bd.map(b => ({
    group_id: b.group_id, group_name: b.group_name, value: b.submitted,
  }));

  const pendingRows: BreakdownRow[] = bd.map(b => ({
    group_id: b.group_id, group_name: b.group_name, value: b.pending,
  }));

  const lateRows: BreakdownRow[] = bd.map(b => ({
    group_id: b.group_id, group_name: b.group_name, value: b.late_submissions,
  }));

  // ── Attendance Today per-batch rows (today's present count only) ──────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const attendanceTodayRows: BreakdownRow[] = attendanceByBatch
    .map(b => {
      const today = b.daily.find(day => day.date === todayStr);
      return { group_id: b.group_id, group_name: b.group_name, value: today?.present ?? 0 };
    })
    .filter(r => r.value > 0);

  return (
    <div className="space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
            <BarChart2 className="h-5 w-5 text-[#0052A5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#00285A] leading-tight">System Dashboard</h1>
            <p className="text-sm text-[#5A7A9A]">
              {selectedBatchName ? `Viewing: ${selectedBatchName}` : 'Real-time overview across all groups'}
            </p>
          </div>
        </div>

        {/* Batch selector */}
        <Select
          value={selectedGroupId ?? 'overall'}
          onValueChange={v => setSelectedGroupId(v === 'overall' ? null : v)}
        >
          <SelectTrigger className="h-9 w-52 text-sm border-[#C5D8EC] rounded-lg focus:ring-[#0052A5]">
            <SelectValue placeholder="Overall" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">Overall</SelectItem>
            {bd.map(b => (
              <SelectItem key={b.group_id} value={b.group_id}>
                {b.group_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Row 1: KPI cards ──────────────────────────────────────────────── */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* 1 — Total Participants */}
        <StaggerItem>
          <BatchBreakdownPopover title="Total Participants" rows={participantRows} disabled={noPopover}>
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Total Participants"
              value={d.kpis.total_participants}
              accent="indigo"
            />
          </BatchBreakdownPopover>
        </StaggerItem>

        {/* 2 — Total Batches (no breakdown) */}
        <StaggerItem>
          <KpiCard
            icon={<FolderKanban className="h-4 w-4" />}
            label="Total Batches"
            value={d.kpis.total_groups}
            accent="cyan"
          />
        </StaggerItem>

        {/* 3 — Classes Today */}
        <StaggerItem>
          <BatchBreakdownPopover title="Classes Today" rows={classesTodayRows} disabled={noPopover}>
            <KpiCard
              icon={<Activity className="h-4 w-4" />}
              label="Classes Today"
              value={d.kpis.classes_today}
              accent="emerald"
            />
          </BatchBreakdownPopover>
        </StaggerItem>

        {/* 4 — Balance 2026 */}
        <StaggerItem>
          <BatchBreakdownPopover title="Balance 2026" rows={upcomingRows} disabled={noPopover}>
            <KpiCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Balance 2026"
              value={d.kpis.classes_upcoming}
            />
          </BatchBreakdownPopover>
        </StaggerItem>

        {/* 5 — Submitted */}
        <StaggerItem>
          <BatchBreakdownPopover
            title="Submitted"
            rows={submittedRows}
            summary={`${totalSubmitted} / ${totalAssignments} total`}
            disabled={noPopover}
          >
            <KpiCard
              icon={<CheckCircle className="h-4 w-4" />}
              label="Submitted"
              value={d.kpis.submitted}
              accent="emerald"
            />
          </BatchBreakdownPopover>
        </StaggerItem>

        {/* 6 — Pending */}
        <StaggerItem>
          <BatchBreakdownPopover title="Pending" rows={pendingRows} disabled={noPopover}>
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label="Pending"
              value={d.kpis.pending}
            />
          </BatchBreakdownPopover>
        </StaggerItem>

        {/* 7 — Late Submissions */}
        <StaggerItem>
          <BatchBreakdownPopover title="Late Submissions" rows={lateRows} disabled={noPopover}>
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Late Submissions"
              value={d.kpis.late}
              accent="rose"
            />
          </BatchBreakdownPopover>
        </StaggerItem>

        {/* 8 — Pending Approvals (no breakdown) */}
        <StaggerItem>
          <KpiCard
            icon={<Bell className="h-4 w-4" />}
            label="Pending Approvals"
            value={d.kpis.pending_approvals}
            accent="amber"
          />
        </StaggerItem>

      </StaggerContainer>

      {/* ── Row 2: Attendance donut + Class status + Weekly trend ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Attendance Today — hover popover shows per-batch present count (Overall mode only) */}
        <StaggerContainer>
          <StaggerItem>
            <BatchBreakdownPopover
              title="Attendance Today"
              rows={attendanceTodayRows}
              disabled={noPopover}
            >
              <ChartContainer
                title="Attendance Today"
                subtitle="Present / Absent / Late breakdown"
                icon={<PieChart className="h-3.5 w-3.5" />}
              >
                <AttendancePieChart data={d.charts.attendance_pie} />
              </ChartContainer>
            </BatchBreakdownPopover>
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
