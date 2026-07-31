import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { GRID_COLOR, AXIS_TICK } from '@/features/charts/chartTokens';
import type { RatingBucket } from '@/api/feedback';

interface RatingDistributionChartProps {
  data: RatingBucket[];
}

const BUCKET_COLORS: Record<string, string> = {
  '1.0': '#EF4444',
  '1.5': '#F97316',
  '2.0': '#F59E0B',
  '2.5': '#EAB308',
  '3.0': '#84CC16',
  '3.5': '#22C55E',
  '4.0': '#10B981',
  '4.5': '#059669',
  '5.0': '#047857',
};

function bucketColor(bucket: string): string {
  return BUCKET_COLORS[bucket] ?? '#64748B';
}

function DistributionTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const { bucket, count } = payload[0].payload;
  return (
    <div className="bg-white border border-[#C5D8EC] rounded-xl shadow-card-md px-3 py-2 text-xs">
      <span className="font-semibold text-[#00285A]">★ {bucket}</span>
      <span className="text-[#5A7A9A] ml-2">— {count} responses</span>
    </div>
  );
}

const BUCKETS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];

export function RatingDistributionChart({ data }: RatingDistributionChartProps) {
  const chartData = BUCKETS.map(b => ({
    bucket: b,
    count: data.find(d => d.bucket === b)?.count ?? 0,
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `★${v}`}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<DistributionTooltip />} cursor={{ fill: '#EBF3FB', radius: 4 }} />
          <Bar dataKey="count" name="Responses" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {chartData.map((entry) => (
              <Cell key={entry.bucket} fill={bucketColor(entry.bucket)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
