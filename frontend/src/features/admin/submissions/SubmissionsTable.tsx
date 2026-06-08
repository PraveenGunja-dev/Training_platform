import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Download, Eye, MessageSquare, Upload, FileText } from 'lucide-react';
import { submissionsApi } from '@/api/submissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/dates';
import { SubmissionPreviewDialog } from './SubmissionPreviewDialog';
import { ManualSubmissionUploadDialog } from './ManualSubmissionUploadDialog';
import { ReviewDialog } from './ReviewDialog';
import type { SubmissionWithUser, LatePolicy, GroupParticipant } from '@/lib/types';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'LATE_SUBMITTED', label: 'Late' },
  { value: 'OVERRIDE_BY_ADMIN', label: 'Override' },
];

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'secondary' }> = {
  SUBMITTED: { label: 'Submitted', variant: 'success' },
  LATE_SUBMITTED: { label: 'Late', variant: 'warning' },
  OVERRIDE_BY_ADMIN: { label: 'Override', variant: 'info' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  taskId: string;
  latePolicy: LatePolicy;
  participants: GroupParticipant[];
  taskTitle?: string;
}

function GradeBadge({ sub }: { sub: SubmissionWithUser }) {
  const review = sub.review;
  if (!review) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  if (review.grade_numeric !== null && review.grade_numeric !== undefined) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        {review.grade_numeric} / 10
      </span>
    );
  }
  if (review.grade_letter) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        {review.grade_letter}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-[#0052A5]">
      Reviewed
    </span>
  );
}

export function SubmissionsTable({ taskId, latePolicy, participants, taskTitle = '' }: Props) {
  const [filter, setFilter] = useState('ALL');
  const [preview, setPreview] = useState<SubmissionWithUser | null>(null);
  const [showManualUpload, setShowManualUpload] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<{
    submissionId: string;
    participantName: string;
  } | null>(null);

  const toggleReview = (id: string) =>
    setExpandedReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', taskId, filter],
    queryFn: () => submissionsApi.listForTask(taskId, filter !== 'ALL' ? { status: filter } : {}),
    enabled: !!taskId,
  });

  const submissions = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Filter chips + manual upload button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === opt.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-muted-foreground border-white/15 hover:border-indigo-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {latePolicy === 'ADMIN_ONLY' && (
          <Button size="sm" variant="outline" onClick={() => setShowManualUpload(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload on Behalf
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-white/8 rounded" />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/70">
          <FileText className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No submissions match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted At</TableHead>
                <TableHead>Ver.</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map(sub => {
                const bd = STATUS_BADGE[sub.status];
                const isExpanded = expandedReviews.has(sub.id);
                const review = sub.review;
                return (
                  <Fragment key={sub.id}>
                    <TableRow>
                      <TableCell>
                        <div className="text-sm font-medium">{sub.user?.full_name ?? sub.user_id}</div>
                        <div className="text-xs text-muted-foreground">{sub.user?.email ?? ''}</div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate" title={sub.file_name}>
                        {sub.file_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatBytes(sub.file_size)}</TableCell>
                      <TableCell>
                        <GradeBadge sub={sub} />
                      </TableCell>
                      <TableCell>
                        {bd && <Badge variant={bd.variant}>{bd.label}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(sub.submitted_at, 'dd MMM yyyy, h:mm a')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">v{sub.version}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setPreview(sub)} title="Preview">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" asChild title="Download">
                            <a href={sub.file_url} download={sub.file_name}>
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title={review ? 'Edit review' : 'Add review'}
                            className={review ? 'text-amber-500 hover:text-amber-600' : ''}
                            onClick={() =>
                              setReviewTarget({
                                submissionId: sub.id,
                                participantName: sub.user?.full_name ?? sub.user_id,
                              })
                            }
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          {review && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title={isExpanded ? 'Collapse review' : 'View review history'}
                              className={isExpanded ? 'text-[#0066BB]' : 'text-slate-400'}
                              onClick={() => toggleReview(sub.id)}
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {review && isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="py-0 px-0">
                          <div className="mx-4 mb-3 mt-0.5 rounded-lg border border-indigo-100 bg-blue-50/60 px-4 py-3 space-y-2">
                            <p className="text-xs font-semibold text-[#0052A5] uppercase tracking-wide">Review History</p>

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
                              <span className="font-medium text-slate-500">{review.reviewer_name ?? 'Reviewer'}</span>
                              {' · '}
                              {new Date(review.reviewed_at).toLocaleDateString('en-US', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <SubmissionPreviewDialog
        submission={preview}
        open={!!preview}
        onClose={() => setPreview(null)}
      />

      <ManualSubmissionUploadDialog
        taskId={taskId}
        participants={participants}
        open={showManualUpload}
        onClose={() => setShowManualUpload(false)}
      />

      {reviewTarget && (
        <ReviewDialog
          open={!!reviewTarget}
          onOpenChange={open => {
            if (!open) setReviewTarget(null);
          }}
          submissionId={reviewTarget.submissionId}
          participantName={reviewTarget.participantName}
          taskTitle={taskTitle}
        />
      )}
    </div>
  );
}
