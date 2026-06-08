import { MessageSquare } from 'lucide-react';
import type { SubmissionReview } from '@/lib/types';

interface FeedbackCardProps {
  review: SubmissionReview;
}

export function FeedbackCard({ review }: FeedbackCardProps) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#0066BB]" />
        <span className="text-sm font-semibold text-[#0052A5]">Instructor Feedback</span>
      </div>

      {review.grade_numeric !== null && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Grade:</span>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
            {review.grade_numeric} / 10
          </span>
        </div>
      )}
      {review.grade_letter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Grade:</span>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
            {review.grade_letter}
          </span>
        </div>
      )}

      {review.comment && (
        <div>
          <p className="text-xs text-slate-500 font-medium mb-1">Comments</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.comment}</p>
        </div>
      )}

      {!review.grade_numeric && !review.grade_letter && !review.comment && (
        <p className="text-sm text-slate-500 italic">Reviewed — no comments added.</p>
      )}

      <p className="text-xs text-slate-400">
        Reviewed by {review.reviewer_name ?? 'Instructor'} ·{' '}
        {new Date(review.reviewed_at).toLocaleDateString('en-US', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </p>
    </div>
  );
}
