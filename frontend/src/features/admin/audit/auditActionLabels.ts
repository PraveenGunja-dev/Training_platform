export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  'auth.login_failed':                  'Login Failed',
  'auth.login_success':                 'Login Succeeded',       // Task 03 adds emission
  'auth.logout':                        'Logged Out',            // Task 03 adds emission
  'auth.password_changed':              'Password Changed',      // Task 03 adds emission
  'auth.email_changed':                 'Email Changed',         // Task 03 adds emission

  // ── User ────────────────────────────────────────────────────────────────────
  'user.invite':                        'User Invited',
  'user.bulk_invite':                   'Users Bulk Invited',
  'user.updated':                       'User Updated',
  'user.deleted':                       'User Deleted',
  'user.role_changed':                  'Role Changed',          // Task 03 adds emission
  'user.resend_invite':                 'Invite Resent',         // Task 03 adds emission
  'user.blocked':                       'User Blocked',          // Task 03 adds emission
  'user.unblocked':                     'User Unblocked',        // Task 03 adds emission
  'sub_mentor_visibility_changed':      'Sub-Mentor Visibility Changed',

  // ── Group ───────────────────────────────────────────────────────────────────
  'group.created':                      'Group Created',
  'group.updated':                      'Group Updated',
  'group.archived':                     'Group Archived',
  'group.participants_added':           'Participants Added',
  'group.participant_removed':          'Participant Removed',
  'group.lead_mentor_assigned':         'Lead Mentor Assigned',  // Task 03 adds emission
  'group.lead_mentor_removed':          'Lead Mentor Removed',   // Task 03 adds emission
  'sub_mentor_assigned':                'Sub-Mentor Assigned',
  'sub_mentor_unassigned':              'Sub-Mentor Unassigned',

  // ── Class ───────────────────────────────────────────────────────────────────
  'class.created':                      'Class Created',
  'class.updated':                      'Class Updated',
  'class.deleted':                      'Class Deleted',
  'class.recurring_created':            'Recurring Classes Created',
  'class.bulk_completed':               'Classes Bulk Completed',

  // ── Assignment ──────────────────────────────────────────────────────────────
  'assignment.task_created':            'Assignment Created',
  'assignment.task_updated':            'Assignment Updated',
  'assignment.task_deleted':            'Assignment Deleted',
  'assignment.task_closed':             'Assignment Closed',
  'assignment.submission_created':      'Submission Created',
  'assignment.submission_reviewed':     'Submission Reviewed',
  'assignment.late_policy_override':    'Late Policy Overridden',

  // ── Document ────────────────────────────────────────────────────────────────
  'document.created':                   'Document Uploaded',
  'document.updated':                   'Document Updated',
  'document.deleted':                   'Document Deleted',

  // ── Shared Document ─────────────────────────────────────────────────────────
  'shared_doc.uploaded':                'Shared Doc Uploaded',
  'shared_doc.approved':                'Shared Doc Approved',
  'shared_doc.rejected':                'Shared Doc Rejected',
  'shared_doc.deleted':                 'Shared Doc Deleted',

  // ── Upload permission ────────────────────────────────────────────────────────
  'upload_permission.granted':          'Upload Permission Granted',
  'upload_permission.revoked':          'Upload Permission Revoked',

  // ── Attendance ──────────────────────────────────────────────────────────────
  'attendance.session_started':         'Attendance Session Started',
  'attendance.session_started_with_drift': 'Attendance Session Started (Drift)',
  'attendance.session_ended':           'Attendance Session Ended',
  'attendance.record_overridden':       'Attendance Record Overridden',

  // ── System ──────────────────────────────────────────────────────────────────
  'system.force_logout_all':            'All Users Force-Logged Out',
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);
