import { Skeleton } from '@/components/ui/skeleton';

type Props = { height?: number };

export function ChartSkeleton({ height = 200 }: Props) {
  return (
    <div aria-label="Loading chart…" aria-busy="true">
      <Skeleton className="w-full rounded-lg" style={{ height }} />
    </div>
  );
}
