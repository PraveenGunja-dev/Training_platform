import { useQuery } from '@tanstack/react-query';
import { Loader2, Star, MessageSquare } from 'lucide-react';
import { feedbackApi, type FeedbackListItem } from '@/api/feedback';
import { StarRating } from '@/components/ui/StarRating';
import { formatDate } from '@/lib/dates';

interface FeedbackListCardProps {
  classId: string;
}

export function FeedbackListCard({ classId }: FeedbackListCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['class-feedback', classId],
    queryFn: () => feedbackApi.list(classId),
  });

  const items: FeedbackListItem[] = data?.data ?? [];
  const count = items.length;
  const avg =
    count > 0
      ? (items.reduce((sum, f) => sum + f.rating, 0) / count).toFixed(1)
      : null;

  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 flex-shrink-0">
          <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00285A] leading-tight">Class Feedback</p>
          <p className="text-xs text-[#5A7A9A]">Participant ratings and comments</p>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 text-[#5A7A9A] animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-[#5A7A9A] py-4 text-center">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {/* Aggregate strip */}
            <div className="flex items-center gap-2 text-sm text-[#5A7A9A]">
              <span className="font-medium text-[#00285A]">{count} participant{count !== 1 ? 's' : ''}</span>
              {avg && (
                <>
                  <span className="text-[#C5D8EC]">|</span>
                  <span className="flex items-center gap-1">
                    Average:
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="font-semibold text-[#00285A]">{avg}</span>
                  </span>
                </>
              )}
            </div>

            {/* Feedback rows */}
            <div className="divide-y divide-[#EBF3FB]">
              {items.map((item, idx) => (
                <div key={idx} className="py-3 grid grid-cols-[1fr_auto] gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#00285A] truncate">{item.participant_name}</p>
                    <p className="text-xs text-[#5A7A9A] mt-0.5 line-clamp-2">
                      {item.comment || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StarRating value={item.rating} readOnly size="sm" />
                    <span className="text-xs text-[#5A7A9A]">
                      {formatDate(item.submitted_at, 'dd MMM yyyy')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
