import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submissionsApi } from '@/api/submissions';
import type { SaveReviewPayload } from '@/lib/types';

export interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  participantName: string;
  taskTitle: string;
}

const reviewSchema = z.object({
  comment: z.string(),
  gradeType: z.enum(['none', 'numeric', 'letter']),
  grade_numeric: z.number().min(0).max(10).nullable(),
  grade_letter: z.string(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

const LETTER_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'] as const;

export function ReviewDialog({
  open,
  onOpenChange,
  submissionId,
  participantName,
  taskTitle,
}: ReviewDialogProps) {
  const queryClient = useQueryClient();

  const { data: existingReview, isLoading } = useQuery({
    queryKey: ['review', submissionId],
    queryFn: () => submissionsApi.getReview(submissionId),
    enabled: open && !!submissionId,
  });

  const { register, handleSubmit, watch, reset } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      comment: '',
      gradeType: 'none',
      grade_numeric: null,
      grade_letter: '',
    },
  });

  const gradeType = watch('gradeType');

  useEffect(() => {
    if (existingReview === undefined) return;
    if (existingReview === null) {
      reset({ comment: '', gradeType: 'none', grade_numeric: null, grade_letter: '' });
      return;
    }
    let resolvedGradeType: 'none' | 'numeric' | 'letter' = 'none';
    if (existingReview.grade_numeric !== null && existingReview.grade_numeric !== undefined) {
      resolvedGradeType = 'numeric';
    } else if (existingReview.grade_letter) {
      resolvedGradeType = 'letter';
    }
    reset({
      comment: existingReview.comment ?? '',
      gradeType: resolvedGradeType,
      grade_numeric:
        existingReview.grade_numeric !== null
          ? Number(existingReview.grade_numeric)
          : null,
      grade_letter: existingReview.grade_letter ?? '',
    });
  }, [existingReview, reset]);

  const saveMutation = useMutation({
    mutationFn: (payload: SaveReviewPayload) =>
      submissionsApi.saveReview(submissionId, payload),
    onSuccess: () => {
      toast.success('Review saved.');
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to save review.');
    },
  });

  const onSubmit = (data: ReviewFormData) => {
    const payload: SaveReviewPayload = { comment: data.comment };
    if (data.gradeType === 'numeric') {
      const num =
        typeof data.grade_numeric === 'number' && !isNaN(data.grade_numeric)
          ? data.grade_numeric
          : null;
      payload.grade_numeric = num;
      payload.grade_letter = '';
    } else if (data.gradeType === 'letter') {
      payload.grade_letter = data.grade_letter as SaveReviewPayload['grade_letter'];
      payload.grade_numeric = null;
    } else {
      payload.grade_numeric = null;
      payload.grade_letter = '';
    }
    saveMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Review Submission — {participantName}</DialogTitle>
          <p className="text-sm text-muted-foreground">Task: {taskTitle}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="comment">Comment / Suggestions</Label>
              <Textarea
                id="comment"
                placeholder="Add feedback or suggestions..."
                rows={4}
                {...register('comment')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gradeType">Grade (Optional)</Label>
              <select
                id="gradeType"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register('gradeType')}
              >
                <option value="none">No Grade</option>
                <option value="numeric">Numeric Score</option>
                <option value="letter">Letter Grade</option>
              </select>
            </div>

            {gradeType === 'numeric' && (
              <div className="space-y-1.5">
                <Label htmlFor="grade_numeric">Score (out of 10)</Label>
                <Input
                  id="grade_numeric"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  {...register('grade_numeric', { valueAsNumber: true })}
                />
              </div>
            )}

            {gradeType === 'letter' && (
              <div className="space-y-1.5">
                <Label htmlFor="grade_letter">Grade</Label>
                <select
                  id="grade_letter"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register('grade_letter')}
                >
                  <option value="">Select grade...</option>
                  {LETTER_GRADES.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Save Review
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
