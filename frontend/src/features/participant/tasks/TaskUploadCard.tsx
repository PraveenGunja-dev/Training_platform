import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, Lock, AlertTriangle, RotateCcw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUploadSubmission } from './useUploadSubmission';
import { formatDate, formatCountdown } from '@/lib/dates';
import { formatBytes } from '@/lib/fileValidation';
import { useCountdown } from '@/hooks/useCountdown';
import { submissionsApi } from '@/api/submissions';
import type { AssignmentTask, Submission } from '@/lib/types';

function getLatestSub(subs: Submission[]): Submission | undefined {
  if (!subs.length) return undefined;
  return subs.reduce((prev, cur) => (cur.version > prev.version ? cur : prev));
}

interface TaskUploadCardProps {
  task: AssignmentTask;
}

export function TaskUploadCard({ task }: TaskUploadCardProps) {
  const [reuploadMode, setReuploadMode] = useState(false);
  const { progress, mutation } = useUploadSubmission(task);

  const { data: subsData } = useQuery({
    queryKey: ['my-submission', task.id],
    queryFn: () => submissionsApi.mySubmissions({ task_id: task.id }),
  });

  const mySubs = subsData?.data ?? [];
  const latestSub = getLatestSub(mySubs);

  const now = new Date();
  const deadline = new Date(task.deadline_at);
  const uploadOpen = new Date(task.upload_open_at);
  const deadlinePassed = now > deadline;
  const isLocked = now < uploadOpen;
  const isStrictClosed = deadlinePassed && task.late_policy === 'STRICT' && !latestSub;
  const isAdminOnly = deadlinePassed && task.late_policy === 'ADMIN_ONLY' && !latestSub;
  const isLateOpen = deadlinePassed && task.late_policy === 'LATE_ALLOWED' && !latestSub;
  const isClosed = task.is_closed;

  const countdownToOpen = useCountdown(isLocked ? task.upload_open_at : null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        mutation.mutate(file);
        setReuploadMode(false);
      }
    },
    [mutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    noClick: false,
  });

  // --- State: Locked ---
  if (isLocked) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground/70" />
            Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-border bg-white/5 p-6 text-center">
            <Lock className="h-8 w-8 text-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Opens at {formatDate(task.upload_open_at, 'dd MMM yyyy, h:mm a')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Opens in {formatCountdown(countdownToOpen)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- State: Closed (strict / admin-only, no submission) ---
  if (isStrictClosed || isAdminOnly) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-rose-200 bg-rose-50 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-rose-700">Deadline Missed</p>
            <p className="text-xs text-rose-500 mt-1">
              {isAdminOnly
                ? 'Only Admin or Manager can submit on your behalf.'
                : 'The deadline has passed and this task does not allow late submissions.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- State: Uploading ---
  if (progress !== null) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Uploading…
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">{progress}%</p>
        </CardContent>
      </Card>
    );
  }

  // --- State: Submitted / Late Submitted ---
  if (latestSub && !reuploadMode) {
    const isLate = latestSub.status === 'LATE_SUBMITTED';
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLate ? (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Late Submission</p>
                <p className="text-xs text-amber-600">This submission was recorded after the deadline.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-800">Submitted successfully</p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-white/5 p-3 space-y-1">
            <p className="text-sm font-medium text-foreground truncate">{latestSub.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(latestSub.file_size)} · Version {latestSub.version}
            </p>
            <p className="text-xs text-muted-foreground">
              Submitted {formatDate(latestSub.submitted_at)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={() => window.open(latestSub.file_url, '_blank')}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={() => setReuploadMode(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-upload
            </Button>
          </div>

          {mySubs.length > 1 && (
            <p className="text-xs text-muted-foreground/70">{mySubs.length} versions total</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- State: Open (or late-open re-upload mode) ---
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          Upload
          {reuploadMode && (
            <Badge variant="info" className="ml-1 text-xs">Re-upload</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLateOpen && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Deadline passed — late submission will be recorded.
            </p>
          </div>
        )}

        {isClosed ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            This task is closed for submissions.
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/10'
                : 'border-white/15 hover:border-white/15 hover:bg-white/5'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 text-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? 'Drop the file here…' : 'Drag & drop a file, or click to choose'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              PDF/DOC/DOCX, JPG/PNG, MP4/MOV/AVI/MKV · Max 500 MB
            </p>
          </div>
        )}

        {reuploadMode && (
          <Button variant="ghost" size="sm" onClick={() => setReuploadMode(false)}>
            Cancel re-upload
          </Button>
        )}

        {mutation.isError && (
          <p className="text-xs text-rose-600 text-center">
            {(mutation.error as { message?: string }).message ?? 'Upload failed'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
