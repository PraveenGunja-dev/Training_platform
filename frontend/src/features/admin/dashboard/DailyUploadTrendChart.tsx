import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from '@/features/charts/ChartTooltip';
import { GRID_COLOR, AXIS_TICK } from '@/features/charts/chartTokens';

interface DailyUploadTrendChartProps {
  data: Array<{ date: string; count: number }>;
}

export function DailyUploadTrendChart({ data }: DailyUploadTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#5A7A9A] text-sm">
        No upload data available.
      </div>
    );
  }

  const chartData = data.map(d => ({ ...d, label: d.date.slice(5) }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
          <defs>
            <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#C5D8EC', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            name="Uploads"
            stroke="#4F46E5"
            strokeWidth={2.5}
            fill="url(#uploadGrad)"
            dot={{ r: 3.5, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
