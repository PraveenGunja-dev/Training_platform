import { Skeleton } from '@/components/ui/skeleton';

type Props = { count?: number };

export function CardSkeleton({ count = 4 }: Props) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-label="Loading…"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-lg border border-white/5" />
      ))}
    </div>
  );
}
