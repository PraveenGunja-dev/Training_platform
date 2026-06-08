import { LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { TodayClassCard } from '@/features/participant/dashboard/TodayClassCard';
import { PendingTasksCard } from '@/features/participant/dashboard/PendingTasksCard';
import { LatestDocumentsCard } from '@/features/participant/dashboard/LatestDocumentsCard';
import { RecentSubmissionsCard } from '@/features/participant/dashboard/RecentSubmissionsCard';
import { QuickStatsCard } from '@/features/participant/dashboard/QuickStatsCard';
import { useDashboardData } from '@/features/participant/dashboard/useDashboardData';
import { AttendanceLiveBanner } from '@/features/participant/attendance/AttendanceLiveBanner';
import { StaggerContainer } from '@/components/motion/StaggerContainer';
import { StaggerItem } from '@/components/motion/StaggerItem';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-[#C5D8EC] rounded-lg" />
      <div className="h-36 bg-white rounded-2xl border border-[#C5D8EC]" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-[#C5D8EC]" />)}
      </div>
      <div className="h-40 bg-white rounded-2xl border border-[#C5D8EC]" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <div key={i} className="h-52 bg-white rounded-2xl border border-[#C5D8EC]" />)}
      </div>
    </div>
  );
}

export default function ParticipantDashboardPage() {
  const { data, isLoading, isError } = useDashboardData();
  const user = useAuthStore(s => s.user);
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data?.data) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-sm text-[#5A7A9A]">Failed to load dashboard. Please refresh.</p>
    </div>
  );
  const d = data.data;

  return (
    <div className="space-y-5">

      {/* ── Greeting header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
          <LayoutDashboard className="h-5 w-5 text-[#0052A5]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#00285A] leading-tight">
            {greeting()}, {firstName}!
          </h1>
          <p className="text-sm text-[#5A7A9A]">{todayLabel()}</p>
        </div>
      </div>

      {/* ── Live attendance banner (conditional) ─────────────────────── */}
      <AttendanceLiveBanner />

      <StaggerContainer className="space-y-5">

        {/* ── Today's class — hero card ─────────────────────────────────── */}
        <StaggerItem>
          <TodayClassCard data={d.today} />
        </StaggerItem>

        {/* ── 3 quick-stat chips ────────────────────────────────────────── */}
        <StaggerItem>
          <QuickStatsCard stats={d.quick_stats} />
        </StaggerItem>

        {/* ── 3-col cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StaggerItem>
            <PendingTasksCard tasks={d.pending_tasks} />
          </StaggerItem>
          <StaggerItem>
            <RecentSubmissionsCard submissions={d.recent_submissions} />
          </StaggerItem>
          <StaggerItem>
            <LatestDocumentsCard docs={d.recent_documents} />
          </StaggerItem>
        </div>

      </StaggerContainer>
    </div>
  );
}
