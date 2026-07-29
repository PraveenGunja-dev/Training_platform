import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from '@/features/charts/ChartTooltip';
import { GRID_COLOR, AXIS_TICK } from '@/features/charts/chartTokens';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BatchAttendanceItem } from '@/api/dashboard';

interface BatchAttendanceChartProps {
  batches: BatchAttendanceItem[];
}

export function BatchAttendanceChart({ batches }: BatchAttendanceChartProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    batches[0]?.group_id ?? '',
  );

  if (batches.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-[#5A7A9A] text-sm">
        No attendance data available.
      </div>
    );
  }

  // If the previously-selected id is no longer in the list (e.g. after refetch), fall back
  const activeBatch =
    batches.find(b => b.group_id === selectedGroupId) ?? batches[0];

  const chartData = (activeBatch.daily ?? []).map(d => ({
    label: d.date.slice(5),   // "MM-DD"
    Present: d.present,
    Absent:  d.absent,
    Late:    d.late,
  }));

  return (
    <div className="space-y-3">

      {/* ── Batch selector + participant count badge ─────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {batches.length > 1 ? (
          <Select
            value={activeBatch.group_id}
            onValueChange={setSelectedGroupId}
          >
            <SelectTrigger className="h-8 w-48 text-xs border-[#C5D8EC] rounded-lg focus:ring-[#0052A5]">
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {batches.map(b => (
                <SelectItem key={b.group_id} value={b.group_id} className="text-xs">
                  {b.group_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-semibold text-[#00285A]">
            {activeBatch.group_name}
          </span>
        )}

        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-[#0052A5] font-medium flex-shrink-0">
          {activeBatch.total_participants} participants
        </span>
      </div>

      {/* ── Bar chart ───────────────────────────────────────────────────── */}
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-[#5A7A9A] text-sm">
          No daily data for this batch.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -8, bottom: 4 }}
              barCategoryGap="28%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: '#EBF3FB', radius: 4 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', color: '#7C7AAE' }}
              />
              <Bar
                dataKey="Present"
                name="Present"
                fill="#10B981"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
              <Bar
                dataKey="Absent"
                name="Absent"
                fill="#F43F5E"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
              <Bar
                dataKey="Late"
                name="Late"
                fill="#F59E0B"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
