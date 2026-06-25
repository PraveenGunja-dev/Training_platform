import { useState } from 'react';
import { AlertCircle, Clock, Download, FileText, Loader2 } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { formatDate, formatCountdown } from '@/lib/dates';
import { assignmentsApi } from '@/api/assignments';
import { toast } from 'sonner';
import type { AssignmentTask } from '@/lib/types';

const latePolicyLabel: Record<string, string> = {
  STRICT:       'Strict Deadline',
  LATE_ALLOWED: 'Late Submission Allowed',
  ADMIN_ONLY:   'Admin / Manager Override Only',
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(type: string): string {
  if (type === 'application/pdf') return '📄';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
  if (type.startsWith('image/')) return '🖼️';
  return '📁';
}

interface TaskInstructionsProps {
  task: AssignmentTask;
}

export function TaskInstructions({ task }: TaskInstructionsProps) {
  const deadline = new Date(task.deadline_at);
  const now = new Date();
  const deadlinePassed = now > deadline;
  const countdown = useCountdown(deadlinePassed ? null : task.deadline_at);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadQuestionFile = async () => {
    setDownloading(true);
    try {
      await assignmentsApi.downloadQuestionFile(task.id, task.question_file_name ?? 'question-file');
    } catch {
      toast.error('Could not download question file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const hasQuestionFile = !!task.question_file_name;

  return (
    <div className="space-y-4">

      {/* ── Question ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
        <div className="px-4 py-3 border-b border-slate-100 bg-blue-50/40">
          <p className="text-sm font-semibold text-[#0052A5]">Question</p>
        </div>
        <div className="p-4 space-y-4">
          {/* Written question */}
          <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{task.question}</p>

          {/* Question file download */}
          {hasQuestionFile && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/60">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
                <span className="text-xl leading-none">
                  {fileTypeIcon(task.question_file_type)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{task.question_file_name}</p>
                {task.question_file_size && (
                  <p className="text-xs text-slate-400">{formatBytes(task.question_file_size)}</p>
                )}
              </div>
              <button
                onClick={handleDownloadQuestionFile}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-gradient text-white text-xs font-semibold transition-colors disabled:opacity-60 flex-shrink-0"
              >
                {downloading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />
                }
                Download
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Description ─────────────────────────────────────────────── */}
      {task.description && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Description</p>
          </div>
          <div className="p-4">
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
          </div>
        </div>
      )}

      {/* ── Instructions ─────────────────────────────────────────────── */}
      {task.instructions && (
        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/40">
            <p className="text-sm font-semibold text-amber-700">Instructions</p>
          </div>
          <div className="p-4">
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{task.instructions}</p>
          </div>
        </div>
      )}

      {/* ── Deadline ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Deadline</p>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600">{formatDate(task.deadline_at)}</p>

          {!deadlinePassed ? (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-indigo-100 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-[#0052A5] flex-shrink-0" />
              <span className="text-sm text-[#0052A5] font-medium">
                {formatCountdown(countdown)} remaining
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span className="text-sm text-rose-700 font-medium">Deadline has passed</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Policy:</span>
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {latePolicyLabel[task.late_policy] ?? task.late_policy}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
