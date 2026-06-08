export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.invite': 'User Invited',
  'user.role_changed': 'Role Changed',
  'user.resend_invite': 'Invite Resent',
  'user.deleted': 'User Deleted',
  'attendance.override': 'Attendance Overridden',
  'assignment.close': 'Assignment Closed',
  'assignment.late_policy_override': 'Late Policy Overridden',
  'shared_doc.approve': 'Shared Doc Approved',
  'shared_doc.reject': 'Shared Doc Rejected',
  'shared_doc.upload': 'Shared Doc Uploaded',
  'class.create': 'Class Created',
  'group.create': 'Group Created',
  'document.upload': 'Document Uploaded',
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);
