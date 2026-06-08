import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from '@/features/charts/ChartTooltip';
import { GRID_COLOR, AXIS_TICK } from '@/features/charts/chartTokens';

export interface WeeklyTrendPoint {
  week: string;
  attendance_rate: number;
  submission_rate: number;
}

interface WeeklyTrendChartProps {
  data: WeeklyTrendPoint[];
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#5A7A9A] text-sm">
        No trend data.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
          <defs>
            <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.16} />
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10B981" stopOpacity={0.16} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="week" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => `${v}%`} />}
            cursor={{ stroke: '#C5D8EC', strokeWidth: 1 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#7C7AAE' }}
          />
          <Area
            type="monotone"
            dataKey="attendance_rate"
            name="Attendance"
            stroke="#4F46E5"
            strokeWidth={2.5}
            fill="url(#attGrad)"
            dot={{ r: 3.5, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="submission_rate"
            name="Submission"
            stroke="#10B981"
            strokeWidth={2.5}
            fill="url(#subGrad)"
            dot={{ r: 3.5, fill: '#10B981', stroke: 'white', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
