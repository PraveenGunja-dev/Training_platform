import { Star, MessageSquare, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/features/charts/KpiCard';
import { BatchBreakdownPopover, type BreakdownRow } from './BatchBreakdownPopover';
import type { FeedbackAnalyticsResponse } from '@/api/feedback';

interface FeedbackOverviewCardsProps {
  data: FeedbackAnalyticsResponse;
  isLoading: boolean;
}

export function FeedbackOverviewCards({ data, isLoading }: FeedbackOverviewCardsProps) {
  const disabled = isLoading || data.per_batch_avg.length === 0;

  const avgResponseRate =
    data.per_batch_avg.length > 0
      ? Math.round(
          (data.per_batch_avg.reduce((s, b) => s + b.response_rate, 0) /
            data.per_batch_avg.length) *
            100,
        )
      : 0;

  const ratingRows: BreakdownRow[] = data.per_batch_avg.map(b => ({
    group_id: b.batch_id,
    group_name: b.batch_name,
    value: b.avg_rating,
    valueSuffix: '★',
  }));

  const responseRows: BreakdownRow[] = data.per_batch_avg.map(b => ({
    group_id: b.batch_id,
    group_name: b.batch_name,
    value: b.total_feedbacks,
  }));

  const rateRows: BreakdownRow[] = data.per_batch_avg.map(b => ({
    group_id: b.batch_id,
    group_name: b.batch_name,
    value: Math.round(b.response_rate * 100),
    valueSuffix: '%',
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <BatchBreakdownPopover title="Rating by Batch" rows={ratingRows} disabled={disabled}>
        <KpiCard
          icon={<Star className="h-4 w-4" />}
          label="Overall Rating"
          value={`★ ${data.overall_avg.toFixed(1)}`}
          accent="amber"
        />
      </BatchBreakdownPopover>

      <BatchBreakdownPopover title="Responses by Batch" rows={responseRows} disabled={disabled}>
        <KpiCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Total Responses"
          value={data.total_feedbacks}
          accent="indigo"
        />
      </BatchBreakdownPopover>

      <BatchBreakdownPopover title="Response Rate by Batch" rows={rateRows} disabled={disabled}>
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg Response Rate"
          value={`${avgResponseRate}%`}
          accent="emerald"
        />
      </BatchBreakdownPopover>
    </div>
  );
}
