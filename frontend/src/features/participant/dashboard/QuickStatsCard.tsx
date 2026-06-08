import { TrendingUp, CheckCircle2, Clock4 } from 'lucide-react';

interface QuickStats {
  attendance_rate: number;
  submitted_count: number;
  pending_count: number;
}

interface StatChipProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  badge: string;
  iconBg: string;
  iconColor: string;
  border: string;
  valueColor: string;
}

function StatChip({ icon, value, label, iconBg, iconColor, border, valueColor }: StatChipProps) {
  return (
    <div className={`bg-white rounded-xl border border-[#C5D8EC] shadow-card border-l-[3px] ${border} px-4 py-3.5 flex items-center gap-3`}>
      <div className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div>
        <p className={`text-xl font-bold leading-none ${valueColor}`}>{value}</p>
        <p className="text-xs text-[#5A7A9A] font-medium mt-1">{label}</p>
      </div>
    </div>
  );
}

export function QuickStatsCard({ stats }: { stats: QuickStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatChip
        icon={<TrendingUp className="h-4 w-4" />}
        value={`${stats.attendance_rate}%`}
        label="Attendance"
        badge="indigo"
        iconBg="bg-blue-100"
        iconColor="text-[#0052A5]"
        border="border-l-indigo-500"
        valueColor="text-[#0052A5]"
      />
      <StatChip
        icon={<CheckCircle2 className="h-4 w-4" />}
        value={stats.submitted_count}
        label="Submitted"
        badge="emerald"
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        border="border-l-emerald-500"
        valueColor="text-emerald-700"
      />
      <StatChip
        icon={<Clock4 className="h-4 w-4" />}
        value={stats.pending_count}
        label="Pending"
        badge="amber"
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
        border="border-l-amber-400"
        valueColor="text-amber-700"
      />
    </div>
  );
}
