import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from '@/features/charts/ChartTooltip';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#10B981',
  Upcoming:  '#4F46E5',
  Ongoing:   '#06B6D4',
  Cancelled: '#F43F5E',
};

export interface ClassStatusPoint {
  label: string;
  value: number;
}

interface ClassStatusChartProps {
  data: ClassStatusPoint[];
}

export function ClassStatusChart({ data }: ClassStatusChartProps) {
  const filtered = data.filter(d => d.value > 0);

  if (filtered.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-[#5A7A9A] text-sm">
        No class data.
      </div>
    );
  }

  const total = filtered.reduce((s, d) => s + d.value, 0);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={76}
            paddingAngle={3}
            dataKey="value"
            nameKey="label"
            strokeWidth={0}
          >
            {filtered.map((entry) => (
              <Cell key={entry.label} fill={STATUS_COLORS[entry.label] ?? '#4F46E5'} />
            ))}
          </Pie>
          <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle">
            <tspan fill="#00285A" fontSize={22} fontWeight={700}>{total}</tspan>
          </text>
          <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle">
            <tspan fill="#5A7A9A" fontSize={10}>Classes</tspan>
          </text>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#7C7AAE' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
