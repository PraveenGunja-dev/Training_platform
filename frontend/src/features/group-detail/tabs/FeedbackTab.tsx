import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { feedbackApi, type FeedbackListItem } from '@/api/feedback';
import { formatDate } from '@/lib/dates';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= rating ? 'text-amber-400' : 'text-slate-200'}>★</span>
      ))}
    </span>
  );
}

function FeedbackRow({ item }: { item: FeedbackListItem }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-[#EBF3FB] last:border-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-[#00285A] truncate">{item.participant_name}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StarRating rating={item.rating} />
          <span className="text-xs text-[#5A7A9A]">{formatDate(item.submitted_at)}</span>
        </div>
      </div>
      {item.comment && (
        <p className="text-sm text-[#3A5A7A] leading-relaxed pl-0.5">{item.comment}</p>
      )}
    </div>
  );
}

function ClassFeedbackCard({ classId, classTitle, classStatus, classDate }: {
  classId: string;
  classTitle: string;
  classStatus: string;
  classDate: string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feedback', 'list', classId],
    queryFn: () => feedbackApi.list(classId),
    enabled: open,
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const avgRating = items.length > 0
    ? (items.reduce((s, i) => s + i.rating, 0) / items.length).toFixed(1)
    : null;

  const statusColor: Record<string, string> = {
    COMPLETED: 'bg-slate-100 text-slate-600',
    ONGOING: 'bg-emerald-50 text-emerald-700',
    UPCOMING: 'bg-blue-50 text-blue-700',
  };

  return (
    <div className="border border-[#D6E8F8] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-[#F5F9FE] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-[#5A7A9A] flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#5A7A9A] flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#00285A] truncate">{classTitle}</p>
            <p className="text-xs text-[#5A7A9A]">{formatDate(classDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {avgRating && (
            <span className="text-xs font-bold text-amber-500">★ {avgRating}</span>
          )}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor[classStatus] ?? 'bg-slate-100 text-slate-600'}`}>
            {classStatus}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 bg-[#F9FBFE] border-t border-[#EBF3FB]">
          {isLoading && (
            <p className="text-sm text-[#5A7A9A] py-4 text-center">Loading feedback…</p>
          )}
          {isError && (
            <p className="text-sm text-rose-500 py-4 text-center">Failed to load feedback.</p>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-[#5A7A9A]">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-sm">No feedback submitted for this class yet.</p>
            </div>
          )}
          {!isLoading && !isError && items.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-[#5A7A9A] uppercase tracking-wide mb-2">
                {items.length} response{items.length !== 1 ? 's' : ''}
              </p>
              {items.map(item => (
                <FeedbackRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type StatusFilter = 'ALL' | 'COMPLETED' | 'ONGOING' | 'UPCOMING';

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Ongoing', value: 'ONGOING' },
  { label: 'Upcoming', value: 'UPCOMING' },
];

const FILTER_ACTIVE = 'bg-[#0052A5] text-white';
const FILTER_IDLE   = 'bg-white text-[#3A5A7A] border border-[#D6E8F8] hover:bg-[#EBF3FB]';

export function FeedbackTab({ groupId }: { groupId: string }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['classes', { group_id: groupId }],
    queryFn: () => classesApi.list({ group_id: groupId, page_size: 200 }),
    staleTime: 30_000,
  });

  const allClasses = data?.data ?? [];
  const classes = statusFilter === 'ALL'
    ? allClasses
    : allClasses.filter(c => c.status === statusFilter);

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-[#5A7A9A]">Loading classes…</div>;
  }

  if (isError) {
    return <div className="p-6 text-center text-sm text-rose-500">Failed to load classes.</div>;
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${statusFilter === f.value ? FILTER_ACTIVE : FILTER_IDLE}`}
          >
            {f.label}
            {f.value !== 'ALL' && (
              <span className="ml-1 opacity-70">
                ({allClasses.filter(c => c.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Class list */}
      {classes.length === 0 ? (
        <div className="p-6 text-center text-sm text-[#5A7A9A]">
          No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase() + ' '}classes found.
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map(cls => (
            <ClassFeedbackCard
              key={cls.id}
              classId={cls.id}
              classTitle={cls.title}
              classStatus={cls.status}
              classDate={cls.starts_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
