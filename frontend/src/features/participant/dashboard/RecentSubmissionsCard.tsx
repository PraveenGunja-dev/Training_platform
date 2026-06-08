import { useNavigate } from 'react-router-dom';
import { Upload, FileCheck2, FileX2, FileClock } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import type { Submission, SubmissionStatus } from '@/lib/types';

function statusConfig(status: SubmissionStatus) {
  if (status === 'SUBMITTED')      return { label: 'Submitted', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: FileCheck2, dot: 'bg-emerald-500' };
  if (status === 'LATE_SUBMITTED') return { label: 'Late',      bg: 'bg-amber-50',   text: 'text-amber-700',   icon: FileClock,  dot: 'bg-amber-400'  };
  return                                  { label: 'Override',  bg: 'bg-blue-50',  text: 'text-[#0052A5]',  icon: FileX2,     dot: 'bg-indigo-400' };
}

export function RecentSubmissionsCard({ submissions }: { submissions: Submission[] }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-[#0066BB]">
          <Upload className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00285A] leading-tight">Recent Submissions</p>
          <p className="text-xs text-[#5A7A9A]">Your latest uploads</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Upload className="h-7 w-7 text-[#C5D8EC]" />
            <p className="text-sm font-medium text-[#00285A]">No submissions yet</p>
            <p className="text-xs text-[#5A7A9A]">Your submitted work will appear here.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {submissions.slice(0, 4).map(sub => {
              const s = statusConfig(sub.status);
              const Icon = s.icon;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => navigate(`/me/submissions/${sub.id}`)}
                  className="flex items-center gap-3 w-full text-left py-2 px-2.5 rounded-lg hover:bg-[#EBF3FB] transition-colors group"
                >
                  <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg ${s.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${s.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#00285A] truncate font-medium leading-tight">{sub.file_name}</p>
                    <p className="text-xs text-[#5A7A9A] mt-0.5">{formatDate(sub.submitted_at, 'dd MMM yyyy')}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
