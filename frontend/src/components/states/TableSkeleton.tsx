import { Skeleton } from '@/components/ui/skeleton';

type Props = { rows?: number; cols?: number };

export function TableSkeleton({ rows = 5, cols = 4 }: Props) {
  return (
    <div
      className="rounded-lg border border-white/5 overflow-hidden"
      aria-label="Loading…"
      aria-busy="true"
    >
      <div className="flex gap-4 px-4 py-3 bg-white/5 border-b border-white/5">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1 max-w-[120px]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-white/5 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
