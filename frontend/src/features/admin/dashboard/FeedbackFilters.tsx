import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface FeedbackFiltersProps {
  batches: Array<{ group_id: string; group_name: string }>;
  selectedBatchId: string | null;
  onBatchChange: (batchId: string | null) => void;
  dateRange: 'last7' | 'last30' | 'last90' | 'all';
  onDateRangeChange: (range: 'last7' | 'last30' | 'last90' | 'all') => void;
}

export function FeedbackFilters({
  batches,
  selectedBatchId,
  onBatchChange,
  dateRange,
  onDateRangeChange,
}: FeedbackFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={selectedBatchId ?? 'all'}
        onValueChange={v => onBatchChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="h-8 w-48 text-xs border-[#C5D8EC] rounded-lg">
          <SelectValue placeholder="All Batches" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Batches</SelectItem>
          {batches.map(b => (
            <SelectItem key={b.group_id} value={b.group_id}>
              {b.group_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={dateRange}
        onValueChange={v => onDateRangeChange(v as 'last7' | 'last30' | 'last90' | 'all')}
      >
        <SelectTrigger className="h-8 w-44 text-xs border-[#C5D8EC] rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last7">Last 7 days</SelectItem>
          <SelectItem value="last30">Last 30 days</SelectItem>
          <SelectItem value="last90">Last 90 days</SelectItem>
          <SelectItem value="all">All time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
