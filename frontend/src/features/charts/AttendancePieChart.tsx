import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

const COLORS = ['#10B981', '#F43F5E', '#F59E0B', '#4F46E5'];
const LABELS = ['Present', 'Absent', 'Late', 'Manual'];

interface AttendancePieChartProps {
  data: Array<{ label: string; value: number }>;
}

export function AttendancePieChart({ data }: AttendancePieChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#5A7A9A] text-sm">
        No attendance data.
      </div>
    );
  }

  const chartData = data.map((d, i) => ({ name: d.label ?? LABELS[i], value: d.value }));
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {COLORS.map((color, i) => (
              <radialGradient key={i} id={`pieGrad${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </radialGradient>
            ))}
          </defs>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          {/* Centre label */}
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle">
            <tspan fill="#00285A" fontSize={24} fontWeight={700}>{total}</tspan>
          </text>
          <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle">
            <tspan fill="#5A7A9A" fontSize={11}>Total</tspan>
          </text>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: '#7C7AAE' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
