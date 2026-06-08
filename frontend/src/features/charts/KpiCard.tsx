import type { ReactNode } from 'react';

type Accent = 'default' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'cyan';

const MAP: Record<Accent, { badge: string; icon: string; border: string; num: string }> = {
  default: { badge: 'bg-blue-50',  icon: 'text-[#0066BB]',  border: 'border-l-blue-300', num: 'text-[#00285A]'   },
  indigo:  { badge: 'bg-blue-100', icon: 'text-[#0052A5]',  border: 'border-l-indigo-500', num: 'text-[#0052A5]'  },
  amber:   { badge: 'bg-amber-50',   icon: 'text-amber-500',   border: 'border-l-amber-400',  num: 'text-amber-700'   },
  emerald: { badge: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-l-emerald-500',num: 'text-emerald-700' },
  rose:    { badge: 'bg-rose-50',    icon: 'text-rose-500',    border: 'border-l-rose-400',   num: 'text-rose-700'    },
  cyan:    { badge: 'bg-cyan-50',    icon: 'text-cyan-600',    border: 'border-l-cyan-500',   num: 'text-cyan-700'    },
};

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: number | string;
  description?: string;
  accent?: Accent;
}

export function KpiCard({ icon, label, value, description, accent = 'default' }: KpiCardProps) {
  const c = MAP[accent];
  return (
    <div className={`bg-white rounded-xl border border-[#C5D8EC] shadow-card border-l-[3px] ${c.border} px-4 py-4 flex items-start gap-3`}>
      <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${c.badge}`}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#7C7AAE] leading-tight truncate">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 leading-none ${c.num}`}>{value}</p>
        {description && <p className="text-xs text-[#5A7A9A] mt-1">{description}</p>}
      </div>
    </div>
  );
}
