import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from '@/features/charts/ChartTooltip';
import { GRID_COLOR, AXIS_TICK } from '@/features/charts/chartTokens';

interface GroupComparisonChartProps {
  data: Array<{ group_name: string; attendance_rate: number; submission_rate: number }>;
}

export function GroupComparisonChart({ data }: GroupComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#5A7A9A] text-sm">
        No group data available.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <YAxis
            dataKey="group_name"
            type="category"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={68}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => `${v}%`} />}
            cursor={{ fill: '#EBF3FB', radius: 4 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#7C7AAE' }}
          />
          <Bar dataKey="attendance_rate" name="Attendance"  fill="#4F46E5" radius={[0, 4, 4, 0]} maxBarSize={18} />
          <Bar dataKey="submission_rate" name="Submission"  fill="#06B6D4" radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
