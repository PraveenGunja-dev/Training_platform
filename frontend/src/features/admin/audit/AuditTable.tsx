import { useState } from 'react';
import { formatDate, formatRelative } from '@/lib/dates';
import { formatAuditAction } from './auditActionLabels';
import { ChevronDown, ChevronRight, User, Clock } from 'lucide-react';
import type { AuditEntry } from '@/lib/types';

// ── Action colour map ────────────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  // creates / invites → indigo
  'user.invite':           'bg-blue-50  text-[#0052A5]  border-blue-200',
  'user.resend_invite':    'bg-blue-50  text-[#0052A5]  border-blue-200',
  'class.create':          'bg-blue-50  text-[#0052A5]  border-blue-200',
  'group.create':          'bg-blue-50  text-[#0052A5]  border-blue-200',
  'document.created':      'bg-blue-50  text-[#0052A5]  border-blue-200',
  'document.upload':       'bg-blue-50  text-[#0052A5]  border-blue-200',
  // approvals / completions → emerald
  'shared_doc.approve':    'bg-emerald-50 text-emerald-700 border-emerald-200',
  'attendance.override':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  // warnings / changes → amber
  'user.role_changed':     'bg-amber-50   text-amber-700   border-amber-200',
  'assignment.late_policy_override': 'bg-amber-50 text-amber-700 border-amber-200',
  'assignment.task_updated': 'bg-amber-50 text-amber-700 border-amber-200',
  // closes / ends → slate
  'assignment.close':           'bg-slate-50  text-slate-600  border-slate-200',
  'attendance.session_ended':   'bg-slate-50  text-slate-600  border-slate-200',
  'attendance.session_started': 'bg-teal-50   text-teal-700   border-teal-200',
  // destructive → rose
  'user.deleted':          'bg-rose-50    text-rose-700    border-rose-200',
  'shared_doc.reject':     'bg-rose-50    text-rose-700    border-rose-200',
  'document.deleted':      'bg-rose-50    text-rose-700    border-rose-200',
  // uploads → violet
  'shared_doc.uploaded':   'bg-violet-50  text-violet-700  border-violet-200',
  'shared_doc.upload':     'bg-violet-50  text-violet-700  border-violet-200',
};

function actionColor(action: string): string {
  return ACTION_COLOR[action] ?? 'bg-slate-50 text-slate-600 border-slate-200';
}

// ── Metadata cell ────────────────────────────────────────────────────────────
function MetadataCell({ metadata }: { metadata: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <span className="text-slate-400 text-xs">—</span>;

  // Show first 2 entries as key=value pills; rest on expand
  const preview = entries.slice(0, 2);
  const hasMore = entries.length > 2;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {preview.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 max-w-[200px]">
            <span className="font-semibold text-slate-500 shrink-0">{k}</span>
            <span className="truncate text-slate-700">{String(v).slice(0, 30)}{String(v).length > 30 ? '…' : ''}</span>
          </span>
        ))}
        {(hasMore || entries.length > 2) && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-0.5 text-xs text-[#0052A5] hover:text-[#002D6E] font-medium transition-colors"
          >
            {expanded
              ? <><ChevronDown className="h-3 w-3" />less</>
              : <><ChevronRight className="h-3 w-3" />{entries.length - 2} more</>
            }
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-wrap gap-1">
          {entries.slice(2).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 max-w-[200px]">
              <span className="font-semibold text-slate-500 shrink-0">{k}</span>
              <span className="truncate text-slate-700">{String(v).slice(0, 40)}{String(v).length > 40 ? '…' : ''}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Target type label ────────────────────────────────────────────────────────
const TARGET_LABELS: Record<string, string> = {
  User: 'User', ClassGroup: 'Group', ClassSession: 'Class',
  AssignmentTask: 'Assignment', AttendanceRecord: 'Attendance',
  AttendanceSession: 'Session', ParticipantSharedDoc: 'Shared Upload',
  Document: 'Document',
};

// ── Main component ────────────────────────────────────────────────────────────
interface AuditTableProps {
  entries: AuditEntry[];
}

export function AuditTable({ entries }: AuditTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 mb-3">
          <Clock className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">No audit entries found.</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 w-36">Time</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 w-44">Actor</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 w-48">Action</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 w-28">Target</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Details</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {entries.map(entry => (
            <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">

              {/* Time */}
              <td className="py-3 px-4 align-top">
                <span
                  className="text-xs font-medium text-slate-600 cursor-default whitespace-nowrap"
                  title={formatDate(entry.created_at, 'dd MMM yyyy, h:mm:ss a')}
                >
                  {formatRelative(entry.created_at)}
                </span>
              </td>

              {/* Actor */}
              <td className="py-3 px-4 align-top">
                {entry.actor ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-[#0052A5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                        {entry.actor.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{entry.actor.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">System</span>
                )}
              </td>

              {/* Action */}
              <td className="py-3 px-4 align-top">
                <span className={`inline-flex items-center text-xs font-semibold border px-2.5 py-1 rounded-full whitespace-nowrap ${actionColor(entry.action)}`}>
                  {formatAuditAction(entry.action)}
                </span>
              </td>

              {/* Target */}
              <td className="py-3 px-4 align-top">
                <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {TARGET_LABELS[entry.target_type] ?? entry.target_type}
                </span>
              </td>

              {/* Metadata */}
              <td className="py-3 px-4 align-top">
                <MetadataCell metadata={entry.metadata} />
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
