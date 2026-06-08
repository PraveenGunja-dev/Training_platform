import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { GRID_COLOR, AXIS_TICK } from './chartTokens';

interface SubmissionBarChartProps {
  data: Array<{ group_name: string; submitted: number; pending: number; late: number }>;
}

export function SubmissionBarChart({ data }: SubmissionBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#5A7A9A] text-sm">
        No submission data.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="group_name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#EBF3FB', radius: 6 }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#7C7AAE' }}
          />
          <Bar dataKey="submitted" name="Submitted" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="pending"   name="Pending"   fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="late"      name="Late"      fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
