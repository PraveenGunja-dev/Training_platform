export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // ── Auth ─────────────────────────────────────────────────────────────
  'auth.login_success':              'Login Successful',
  'auth.login_failed':               'Login Failed',
  'auth.logout':                     'Logged Out',
  'auth.password_changed':           'Password Changed',
  'auth.email_changed':              'Email Changed',

  // ── Users ────────────────────────────────────────────────────────────
  'user.invite':                     'User Invited',
  'user.bulk_invite':                'Users Bulk Invited',
  'user.resend_invite':              'Invite Resent',
  'user.updated':                    'User Updated',
  'user.deleted':                    'User Deleted',
  'user.role_changed':               'Role Changed',
  'user.blocked':                    'User Blocked',
  'user.unblocked':                  'User Unblocked',

  // ── Groups ───────────────────────────────────────────────────────────
  'group.created':                   'Group Created',
  'group.updated':                   'Group Updated',
  'group.archived':                  'Group Archived',
  'group.participants_added':        'Participants Added to Group',
  'group.participant_removed':       'Participant Removed from Group',
  'group.lead_mentor_assigned':      'Lead Mentor Assigned',
  'group.lead_mentor_removed':       'Lead Mentor Removed',
  'sub_mentor_assigned':             'Sub-Mentor Assigned to Group',
  'sub_mentor_unassigned':           'Sub-Mentor Removed from Group',

  // ── Classes / Scheduling ─────────────────────────────────────────────
  'class.created':                   'Class Created',
  'class.updated':                   'Class Updated',
  'class.deleted':                   'Class Deleted',
  'class.recurring_created':         'Recurring Classes Created',
  'class.bulk_completed':            'Classes Bulk Completed',

  // ── Attendance ───────────────────────────────────────────────────────
  'attendance.session_started':              'Attendance Session Started',
  'attendance.session_started_with_drift':   'Attendance Session Started (Time Drift)',
  'attendance.session_ended':                'Attendance Session Ended',
  'attendance.record_overridden':            'Attendance Record Overridden',

  // ── Assignments ──────────────────────────────────────────────────────
  'assignment.task_created':         'Assignment Task Created',
  'assignment.task_updated':         'Assignment Task Updated',
  'assignment.task_deleted':         'Assignment Task Deleted',
  'assignment.task_closed':          'Assignment Closed',
  'assignment.late_policy_override': 'Late Policy Overridden',
  'assignment.submission_created':   'Assignment Submitted',
  'assignment.submission_reviewed':  'Submission Reviewed',

  // ── Documents & Shared Docs ──────────────────────────────────────────
  'document.created':                'Document Uploaded',
  'document.updated':                'Document Updated',
  'document.deleted':                'Document Deleted',
  'upload_permission.granted':       'Upload Permission Granted',
  'upload_permission.revoked':       'Upload Permission Revoked',
  'shared_doc.uploaded':             'Shared Doc Uploaded',
  'shared_doc.deleted':              'Shared Doc Deleted',
  'shared_doc.approved':             'Shared Doc Approved',
  'shared_doc.rejected':             'Shared Doc Rejected',

  // ── System ───────────────────────────────────────────────────────────
  'system.force_logout_all':         'Force Logout All Users',
  'sub_mentor_visibility_changed':   'Sub-Mentor Visibility Changed',
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);
