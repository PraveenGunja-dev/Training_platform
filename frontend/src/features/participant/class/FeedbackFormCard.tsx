import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { feedbackApi } from '@/api/feedback';
import { StarRating } from '@/components/ui/StarRating';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { ClassSession } from '@/lib/types';

interface FeedbackFormCardProps {
  cls: ClassSession;
}

export function FeedbackFormCard({ cls }: FeedbackFormCardProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data: feedbackData, isLoading } = useQuery({
    queryKey: ['my-feedback', cls.id],
    queryFn: () => feedbackApi.getMy(cls.id),
    staleTime: 60_000,
    retry: false,
  });

  const existing = feedbackData?.data ?? null;

  const mutation = useMutation({
    mutationFn: () => feedbackApi.submit(cls.id, rating, comment),
    onSuccess: (submittedData) => {
      // Populate the cache immediately so the read-only view appears as soon as
      // the success banner clears — no form flash while a background refetch runs.
      qc.setQueryData(['my-feedback', cls.id], submittedData);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 1500);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { errors?: { code?: string; message?: string }[]; detail?: string } } };
      const firstError = e?.response?.data?.errors?.[0];

      // If feedback was already submitted (duplicate submission), force-reload
      // the existing feedback so the read-only view appears instead of an error.
      if (firstError?.code === 'already_submitted') {
        void qc.invalidateQueries({ queryKey: ['my-feedback', cls.id] });
        return;
      }

      const msg = firstError?.message ?? e?.response?.data?.detail ?? 'Failed to submit feedback. Please try again.';
      setErrorMsg(msg);
    },
  });

  const canSubmit = rating > 0 && !mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : submitSuccess ? (
          <div className="flex items-center gap-2 py-2 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Thank you for your feedback!</span>
          </div>
        ) : existing ? (
          <div className="space-y-3">
            <StarRating value={Number(existing.rating)} readOnly size="md" />
            {existing.comment && (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{existing.comment}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Submitted on{' '}
              {new Date(existing.submitted_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>
                Rating <span className="text-red-500">*</span>
              </Label>
              <StarRating value={rating} onChange={setRating} size="lg" />
              {rating === 0 && (
                <p className="text-xs text-muted-foreground">Select a rating to submit</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-comment">
                Comment{' '}
                <span className="text-muted-foreground/70 text-xs">(optional)</span>
              </Label>
              <Textarea
                id="feedback-comment"
                placeholder="Share your feedback about this class…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {comment.length}/2000
              </p>
            </div>

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? (
                <>
                  <span className="mr-2 animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white inline-block" />
                  Submitting…
                </>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
