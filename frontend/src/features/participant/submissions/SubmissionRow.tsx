import { Fragment, useState } from 'react';
import { ChevronDown, Download, FileText, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmissionStatusBadge } from './SubmissionStatusBadge';
import { formatDate } from '@/lib/dates';
import { formatBytes } from '@/lib/fileValidation';
import type { Submission, AssignmentTask } from '@/lib/types';

interface SubmissionRowProps {
  submission: Submission;
  task?: AssignmentTask;
}

export function SubmissionRow({ submission, task }: SubmissionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const review = submission.review;

  return (
    <Fragment>
      <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground/70 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate max-w-xs">
                {task?.title ?? submission.task_id}
              </p>
              {submission.version > 1 && (
                <p className="text-xs text-muted-foreground/70">Version {submission.version}</p>
              )}
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <p className="text-sm text-foreground/90 truncate max-w-[200px]">{submission.file_name}</p>
          <p className="text-xs text-muted-foreground/70">{formatBytes(submission.file_size)}</p>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(submission.submitted_at)}
        </td>
        <td className="py-3 px-4">
          <SubmissionStatusBadge status={submission.status} />
        </td>
        <td className="py-3 px-4">
          {review?.grade_numeric !== null && review?.grade_numeric !== undefined ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {review.grade_numeric} / 10
            </span>
          ) : review?.grade_letter ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {review.grade_letter}
            </span>
          ) : review ? (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-[#0052A5]">
              Reviewed
            </span>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5"
              onClick={() => window.open(submission.file_url, '_blank')}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            {review && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 gap-1 ${expanded ? 'text-[#0052A5]' : 'text-slate-400'}`}
                title={expanded ? 'Hide feedback' : 'View feedback'}
                onClick={() => setExpanded(v => !v)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
              </Button>
            )}
          </div>
        </td>
      </tr>

      {review && expanded && (
        <tr className="bg-blue-50/40">
          <td colSpan={6} className="px-0 py-0">
            <div className="mx-4 my-2 rounded-lg border border-indigo-100 bg-white px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#0066BB] shrink-0" />
                <span className="text-xs font-semibold text-[#0052A5] uppercase tracking-wide">Instructor Feedback</span>
              </div>

              {(review.grade_numeric !== null && review.grade_numeric !== undefined) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium w-16">Grade</span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {review.grade_numeric} / 10
                  </span>
                </div>
              )}
              {review.grade_letter && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium w-16">Grade</span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {review.grade_letter}
                  </span>
                </div>
              )}

              {review.comment ? (
                <div className="flex gap-2">
                  <span className="text-xs text-slate-500 font-medium w-16 pt-0.5 shrink-0">Comment</span>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.comment}</p>
                </div>
              ) : !review.grade_numeric && !review.grade_letter ? (
                <p className="text-xs text-slate-400 italic">No grade or comment recorded.</p>
              ) : null}

              <p className="text-xs text-slate-400 pt-1">
                Reviewed by{' '}
                <span className="font-medium text-slate-500">{review.reviewer_name ?? 'Instructor'}</span>
                {' · '}
                {new Date(review.reviewed_at).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
