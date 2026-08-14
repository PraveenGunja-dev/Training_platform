import type { ClassRatingItem } from '@/api/feedback';

interface TopBottomClassesTableProps {
  topClasses: ClassRatingItem[];
  bottomClasses: ClassRatingItem[];
}

function ClassRow({ item, variant }: { item: ClassRatingItem; variant: 'top' | 'bottom' }) {
  const ratingColor = variant === 'top' ? 'text-emerald-700' : 'text-rose-600';
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-[#EBF3FB] last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#00285A] truncate" title={item.class_name}>
          {item.class_name}
        </p>
        <p className="text-[10px] text-[#5A7A9A] truncate">{item.batch_name}</p>
      </div>
      <span className={`text-xs font-bold flex-shrink-0 ${ratingColor}`}>
        ★ {item.avg_rating.toFixed(1)}
      </span>
    </div>
  );
}

export function TopBottomClassesTable({ topClasses, bottomClasses }: TopBottomClassesTableProps) {
  if (topClasses.length === 0 && bottomClasses.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 flex items-center justify-center text-[#5A7A9A] text-sm col-span-2">
          No class rating data available.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
          Top Rated Classes
        </p>
        <div className="space-y-1.5">
          {topClasses.slice(0, 5).map(cls => (
            <ClassRow key={cls.class_id} item={cls} variant="top" />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2">
          Lowest Rated Classes
        </p>
        <div className="space-y-1.5">
          {bottomClasses.slice(0, 5).map(cls => (
            <ClassRow key={cls.class_id} item={cls} variant="bottom" />
          ))}
        </div>
      </div>
    </div>
  );
}
