import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { GRID_COLOR, AXIS_TICK, C } from '@/features/charts/chartTokens';

interface FeedbackTrendChartProps {
  data: Array<{ date: string; avg: number }>;
}

export function FeedbackTrendChart({ data }: FeedbackTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-[#5A7A9A] text-sm">
        No trend data for the selected period.
      </div>
    );
  }

  const chartData = data.map(d => ({
    label: d.date.slice(5),
    avg: d.avg,
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-white border border-[#C5D8EC] rounded-xl shadow-card-md px-3 py-2 text-xs">
                  <p className="font-semibold text-[#00285A] mb-1">{label}</p>
                  <p className="text-[#5A7A9A]">
                    Avg rating:{' '}
                    <span className="font-semibold text-[#00285A]">
                      ★ {(payload[0].value as number).toFixed(2)}
                    </span>
                  </p>
                </div>
              );
            }}
            cursor={{ stroke: '#C5D8EC', strokeWidth: 1 }}
          />
          <ReferenceLine
            y={3.5}
            stroke="#F59E0B"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: 'threshold 3.5', position: 'insideTopRight', fontSize: 10, fill: '#F59E0B' }}
          />
          <Line
            type="monotone"
            dataKey="avg"
            name="Avg Rating"
            stroke={C.indigo}
            strokeWidth={2.5}
            dot={{ r: 3, fill: C.indigo, stroke: 'white', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
