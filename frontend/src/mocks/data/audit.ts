import type { AuditEntry } from '@/lib/types';

export const auditData: AuditEntry[] = [
  // user.invite × 10
  { id: 'audit-001', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-manager', metadata: { email: 'manish.kumar@adani.com', role: 'ADMIN' }, created_at: '2026-01-15T00:00:00Z' },
  { id: 'audit-002', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-mgr-002', metadata: { email: 'neha.singh@adani.com', role: 'ADMIN' }, created_at: '2026-01-20T00:00:00Z' },
  { id: 'audit-003', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part', metadata: { email: 'rutvik.prajapati@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-05T00:00:00Z' },
  { id: 'audit-004', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-002', metadata: { email: 'arjun.reddy@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-05T01:00:00Z' },
  { id: 'audit-005', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-003', metadata: { email: 'divya.nair@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-05T02:00:00Z' },
  { id: 'audit-006', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-011', metadata: { email: 'amit.sharma@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-10T00:00:00Z' },
  { id: 'audit-007', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-021', metadata: { email: 'gaurav.singh@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-15T00:00:00Z' },
  { id: 'audit-008', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-027', metadata: { email: 'naveen.joshi@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-17T00:00:00Z' },
  { id: 'audit-009', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-029', metadata: { email: 'ramesh.nair@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-18T00:00:00Z' },
  { id: 'audit-010', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.invite', target_type: 'User', target_id: 'u-part-030', metadata: { email: 'kavya.gupta@adani.com', role: 'PARTICIPANT' }, created_at: '2026-02-18T01:00:00Z' },

  // user.role_changed × 2
  { id: 'audit-011', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.role_changed', target_type: 'User', target_id: 'u-mgr-003', metadata: { old_role: 'PARTICIPANT', new_role: 'ADMIN' }, created_at: '2026-02-01T00:00:00Z' },
  { id: 'audit-012', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.role_changed', target_type: 'User', target_id: 'u-part-005', metadata: { old_role: 'ADMIN', new_role: 'PARTICIPANT' }, created_at: '2026-03-10T09:00:00Z' },

  // attendance.override × 8
  { id: 'audit-013', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-a2-p01', metadata: { new_status: 'MANUAL_PRESENT', user_id: 'u-part', note: 'Verified attendance.' }, created_at: '2026-05-02T11:00:00Z' },
  { id: 'audit-014', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-a2-p02', metadata: { new_status: 'MANUAL_PRESENT', user_id: 'u-part-002' }, created_at: '2026-05-02T11:05:00Z' },
  { id: 'audit-015', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-a2-p09', metadata: { new_status: 'MANUAL_PRESENT', user_id: 'u-part-009' }, created_at: '2026-05-12T10:00:00Z' },
  { id: 'audit-016', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-c1-p21', metadata: { new_status: 'ABSENT', user_id: 'u-part-021', note: 'Arrived after window.' }, created_at: '2026-05-03T14:00:00Z' },
  { id: 'audit-017', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-c2-p22', metadata: { new_status: 'MANUAL_PRESENT', user_id: 'u-part-022' }, created_at: '2026-05-04T10:00:00Z' },
  { id: 'audit-018', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-a3-p05', metadata: { new_status: 'MANUAL_PRESENT', user_id: 'u-part-005', note: 'System error fix.' }, created_at: '2026-05-09T15:00:00Z' },
  { id: 'audit-019', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-b1-p11', metadata: { new_status: 'MANUAL_PRESENT', user_id: 'u-part-011' }, created_at: '2026-04-28T13:00:00Z' },
  { id: 'audit-020', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-b2-p12', metadata: { new_status: 'ABSENT', user_id: 'u-part-012', note: 'Retroactive correction.' }, created_at: '2026-04-29T09:00:00Z' },

  // shared_doc.approve × 4
  { id: 'audit-021', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'shared_doc.approve', target_type: 'ParticipantSharedDoc', target_id: 'shared-001', metadata: { visibility: 'GROUP', uploader: 'u-part' }, created_at: '2026-05-10T10:00:00Z' },
  { id: 'audit-022', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'shared_doc.approve', target_type: 'ParticipantSharedDoc', target_id: 'shared-002', metadata: { visibility: 'GROUP', uploader: 'u-part-021' }, created_at: '2026-05-13T09:00:00Z' },
  { id: 'audit-023', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'shared_doc.approve', target_type: 'ParticipantSharedDoc', target_id: 'shared-004', metadata: { visibility: 'GROUP', uploader: 'u-part-002' }, created_at: '2026-05-14T11:00:00Z' },
  { id: 'audit-024', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'shared_doc.approve', target_type: 'ParticipantSharedDoc', target_id: 'shared-005', metadata: { visibility: 'GROUP', uploader: 'u-part-003' }, created_at: '2026-05-15T09:30:00Z' },

  // shared_doc.reject × 2
  { id: 'audit-025', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'shared_doc.reject', target_type: 'ParticipantSharedDoc', target_id: 'shared-003', metadata: { reason: 'Unverified information.' }, created_at: '2026-05-11T10:00:00Z' },
  { id: 'audit-026', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'shared_doc.reject', target_type: 'ParticipantSharedDoc', target_id: 'shared-006', metadata: { reason: 'Incomplete submission.' }, created_at: '2026-05-15T14:00:00Z' },

  // user.deleted × 1
  { id: 'audit-027', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.deleted', target_type: 'User', target_id: 'u-ex-001', metadata: { email: 'ex.employee@adani.com' }, created_at: '2026-04-01T00:00:00Z' },

  // user.resend_invite × 4
  { id: 'audit-031', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.resend_invite', target_type: 'User', target_id: 'u-part-009', metadata: { email: 'vikram.singh@adani.com' }, created_at: '2026-05-14T09:25:00Z' },
  { id: 'audit-032', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.resend_invite', target_type: 'User', target_id: 'u-part-020', metadata: { email: 'lakshmi.pillai@adani.com' }, created_at: '2026-05-13T14:00:00Z' },
  { id: 'audit-033', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.resend_invite', target_type: 'User', target_id: 'u-part-005', metadata: { email: 'suresh.gupta@adani.com' }, created_at: '2026-04-10T10:00:00Z' },
  { id: 'audit-034', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'user.resend_invite', target_type: 'User', target_id: 'u-part-015', metadata: { email: 'aditya.kumar@adani.com' }, created_at: '2026-04-15T09:00:00Z' },

  // class.create × 5
  { id: 'audit-035', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'class.create', target_type: 'ClassSession', target_id: 'c-safety-a-1', metadata: { group_id: 'g-batch-a', title: 'Fire Safety Fundamentals' }, created_at: '2026-04-20T09:00:00Z' },
  { id: 'audit-036', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'class.create', target_type: 'ClassSession', target_id: 'c-safety-a-2', metadata: { group_id: 'g-batch-a', title: 'Evacuation Procedures' }, created_at: '2026-04-25T09:00:00Z' },
  { id: 'audit-037', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'class.create', target_type: 'ClassSession', target_id: 'c-safety-a-3', metadata: { group_id: 'g-batch-a', title: 'Hazardous Materials Safety' }, created_at: '2026-05-01T09:00:00Z' },
  { id: 'audit-038', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'class.create', target_type: 'ClassSession', target_id: 'c-safety-a-4', metadata: { group_id: 'g-batch-a', title: 'Safety Assessment & Certification' }, created_at: '2026-05-13T11:00:00Z' },
  { id: 'audit-039', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'class.create', target_type: 'ClassSession', target_id: 'c-ops-1', metadata: { group_id: 'g-batch-c', title: 'Operations Fundamentals' }, created_at: '2026-04-22T10:00:00Z' },

  // group.create × 3
  { id: 'audit-040', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'group.create', target_type: 'ClassGroup', target_id: 'g-batch-a', metadata: { name: 'Safety Induction Batch A' }, created_at: '2026-01-20T00:00:00Z' },
  { id: 'audit-041', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'group.create', target_type: 'ClassGroup', target_id: 'g-batch-b', metadata: { name: 'Safety Induction Batch B' }, created_at: '2026-01-22T00:00:00Z' },
  { id: 'audit-042', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'group.create', target_type: 'ClassGroup', target_id: 'g-batch-d', metadata: { name: 'Management Training Cohort' }, created_at: '2026-02-10T00:00:00Z' },

  // document.upload × 4
  { id: 'audit-043', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'document.upload', target_type: 'Document', target_id: 'doc-001', metadata: { title: 'Fire Safety Training Slides', group_id: 'g-batch-a' }, created_at: '2026-04-20T10:00:00Z' },
  { id: 'audit-044', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'document.upload', target_type: 'Document', target_id: 'doc-006', metadata: { title: 'Advanced Operations Guide', group_id: 'g-batch-c' }, created_at: '2026-04-22T11:00:00Z' },
  { id: 'audit-045', actor: { id: 'u-mgr-003', full_name: 'Raj Patel', email: 'raj.patel@adani.com' }, action: 'document.upload', target_type: 'Document', target_id: 'doc-013', metadata: { title: 'Leadership Frameworks Overview', group_id: 'g-batch-d' }, created_at: '2026-05-08T09:00:00Z' },
  { id: 'audit-046', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'document.upload', target_type: 'Document', target_id: 'doc-003', metadata: { title: 'Evacuation Procedures Checklist', group_id: 'g-batch-a' }, created_at: '2026-04-26T09:00:00Z' },

  // shared_doc.upload × 3
  { id: 'audit-047', actor: { id: 'u-part', full_name: 'Rutvik Prajapati', email: 'rutvik.prajapati@adani.com' }, action: 'shared_doc.upload', target_type: 'ClassGroup', target_id: 'g-batch-a', metadata: { file_name: 'safety_notes_rutvik.pdf' }, created_at: '2026-05-09T14:00:00Z' },
  { id: 'audit-048', actor: { id: 'u-part-021', full_name: 'Gaurav Singh', email: 'gaurav.singh@adani.com' }, action: 'shared_doc.upload', target_type: 'ClassGroup', target_id: 'g-batch-c', metadata: { file_name: 'ops_research_gaurav.pdf' }, created_at: '2026-05-14T12:00:00Z' },
  { id: 'audit-049', actor: { id: 'u-part-002', full_name: 'Arjun Reddy', email: 'arjun.reddy@adani.com' }, action: 'shared_doc.upload', target_type: 'ClassGroup', target_id: 'g-batch-a', metadata: { file_name: 'fire_safety_summary.docx' }, created_at: '2026-05-13T16:00:00Z' },

  // assignment.close × 2
  { id: 'audit-050', actor: { id: 'u-manager', full_name: 'Manish Kumar', email: 'manish.kumar@adani.com' }, action: 'assignment.close', target_type: 'AssignmentTask', target_id: 'task-001', metadata: { reason: 'Deadline passed.' }, created_at: '2026-05-06T18:30:00Z' },
  { id: 'audit-051', actor: { id: 'u-mgr-002', full_name: 'Neha Singh', email: 'neha.singh@adani.com' }, action: 'assignment.close', target_type: 'AssignmentTask', target_id: 'task-004', metadata: { reason: 'Manually closed by admin.' }, created_at: '2026-05-07T17:00:00Z' },

  // assignment.late_policy_override × 1
  { id: 'audit-052', actor: { id: 'u-admin', full_name: 'Kiran K R', email: 'kiran.kr@adani.com' }, action: 'assignment.late_policy_override', target_type: 'AssignmentTask', target_id: 'task-002', metadata: { old_policy: 'STRICT', new_policy: 'LATE_ALLOWED', reason: 'Technical issues during deadline window.' }, created_at: '2026-05-06T12:00:00Z' },
];
