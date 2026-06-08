export type Role = 'ADMIN' | 'INSTRUCTOR' | 'PARTICIPANT';
export type ClassStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'MANUAL_PRESENT';
export type AttendanceSessionStatus = 'ACTIVE' | 'ENDED';
export type LatePolicy = 'STRICT' | 'LATE_ALLOWED' | 'ADMIN_ONLY';
export type SubmissionStatus = 'SUBMITTED' | 'LATE_SUBMITTED' | 'OVERRIDE_BY_ADMIN';
export type LetterGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
export type DocVisibility = 'GROUP' | 'SELECTED' | 'STAFF_ONLY' | 'PUBLIC_TO_CLASS';
export type SharedDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type NotificationType =
  | 'DEADLINE_REMINDER'
  | 'TASK_OPENED'
  | 'SHARED_DOC_RESULT'
  | 'CLASS_SCHEDULED'
  | 'CLASS_STARTING_SOON'
  | 'CLASS_RESCHEDULED'
  | 'CLASS_DOCUMENT_ADDED'
  | 'CLASS_TASK_ASSIGNED'
  | 'ATTENDANCE_OVERRIDE'
  | 'INVITE_RESENT'
  | 'ATTENDANCE_SESSION_STARTED'
  | 'ATTENDANCE_SESSION_ENDED'
  | 'ATTENDANCE_CLOSING_SOON'
  | 'GROUP_ADDED'
  // Instructor notification types
  | 'GROUP_ASSIGNED'
  | 'GROUP_UNASSIGNED'
  | 'CO_INSTRUCTOR_ADDED'
  | 'CLASS_SCHEDULED_BY_ADMIN'
  | 'CLASS_CANCELLED'
  | 'CO_INSTRUCTOR_EDITED_CLASS'
  | 'ASSIGNMENT_CREATED_IN_GROUP'
  | 'SUBMISSION_RECEIVED'
  | 'DEADLINE_APPROACHING'
  | 'ATTENDANCE_SESSION_REMINDER'
  | 'PARTICIPANTS_ADDED_TO_GROUP'
  | 'PARTICIPANTS_REMOVED_FROM_GROUP'
  | 'SHARED_UPLOAD_PENDING'
  | 'SUBMISSION_REVIEWED'
  | 'LATE_ATTENDANCE_QR_SHARED';

export interface NotificationPreference {
  in_app_enabled: boolean;
  email_enabled: boolean;
  digest_submissions: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
  can_view_all_classes?: boolean | null;
  must_change_password?: boolean;
  business_unit?: string;
  grade_code?: string;
  department?: string;
  employee_code?: string;
}

export interface SystemSettings {
  product_name: string;
  timezone: string;
  brand_color: string;
  doc_max_mb: number;
  image_max_mb: number;
  video_max_mb: number;
  reminder_offsets: number[];
  session_lifetime_hours: number;
  instructors_can_view_all_classes?: boolean;
}

export interface GroupInstructor {
  id: string;
  full_name: string;
  email: string;
  assigned_at: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  description: string;
  participants_count: number;
  is_archived: boolean;
  created_at: string;
  instructors: { id: string; full_name: string; email: string }[];
}

export interface GroupParticipant extends User {
  attendance_rate: number;
  submission_rate: number;
}

export interface GroupDetail extends ClassGroup {
  participants: GroupParticipant[];
}

export interface GroupAnalytics {
  attendance_trend: Array<{ week: string; rate: number }>;
  submission_completion: { completed: number; total: number };
  top_participants: Array<{ id: string; name: string; attendance_rate: number; submissions: number }>;
}

// --- Attendance (session-based, v2) ---

export interface AttendanceSession {
  id: string;
  class_id: string;
  class_title: string;
  group_id: string;
  started_at: string;
  started_by: { id: string; full_name: string };
  ended_at: string | null;
  ended_by: { id: string; full_name: string } | null;
  status: AttendanceSessionStatus;
  duration_minutes: number | null;
  scheduled_end_at: string | null;
  // Populated by listSessions annotation; absent in single-session contexts.
  present_count?: number | null;
  absent_count?: number | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  user_id: string;
  marked_at: string;
  status: 'PRESENT' | 'ABSENT';
}

export interface ActiveSessionResponse {
  session: AttendanceSession | null;
  my_record: AttendanceRecord | null;
}

// Legacy record shape — used by admin override handlers until F-X-05 migrates them.
export interface LegacyAttendanceRecord {
  id: string;
  class_id: string;
  user_id: string;
  status: AttendanceStatus;
  marked_at: string | null;
  override_by: string | null;
  note: string;
}

// --- Class ---

export interface RelatedTask {
  id: string;
  title: string;
  is_open: boolean;
  is_closed: boolean;
  upload_open_at: string;
  deadline_at: string;
}

export interface ClassSession {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  attendance_open_at: string;
  attendance_close_at: string;
  allow_late_attendance: boolean;
  status: ClassStatus;
  // Enriched by participant-scoped endpoints (legacy window-based)
  attendance_status?: AttendanceStatus | null;
  attendance_marked_at?: string | null;
  // Session-based fields (v2 contract — populated by mock withAttendance + real backend B-04)
  active_session?: AttendanceSession | null;
  last_session?: {
    id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number | null;
    scheduled_end_at: string | null;
  } | null;
  my_record?: AttendanceRecord | null;
  participants_count?: number;
  related_tasks?: RelatedTask[];
  meeting_link?: string;
  // Cross-visibility flag: true when instructor sees a non-assigned class
  read_only?: boolean;
}

export interface AssignmentTask {
  id: string;
  group_id: string;
  group_name: string;
  class_id: string | null;
  class_title: string | null;
  title: string;
  question: string;
  description: string;
  instructions: string;
  upload_open_at: string;
  deadline_at: string;
  late_policy: LatePolicy;
  reminder_offsets: number[];
  is_open: boolean;
  is_closed: boolean;
  question_file_url: string;
  question_file_name: string;
  question_file_type: string;
  question_file_size: number | null;
  created_at: string;
}

export interface SubmissionReview {
  id: number;
  submission_id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  comment: string;
  grade_numeric: number | null;
  grade_letter: LetterGrade | '';
  reviewed_at: string;
  updated_at: string;
}

export interface SaveReviewPayload {
  comment?: string;
  grade_numeric?: number | null;
  grade_letter?: LetterGrade | '';
}

export interface Submission {
  id: string;
  task_id: string;
  user_id: string;
  version: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: SubmissionStatus;
  submitted_at: string;
  submitted_by: string;
  note: string;
  review: SubmissionReview | null;
}

export interface SubmissionWithUser extends Submission {
  user?: Pick<User, 'id' | 'full_name' | 'email' | 'photo_url'>;
}

export interface Document {
  id: string;
  group_id: string;
  class_id: string | null;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  doc_type: string;
  visibility: DocVisibility;
  allowed_user_ids: string[];
  uploaded_by_id: string;
  created_at: string;
  updated_at?: string;
}

export interface ParticipantSharedDoc {
  id: string;
  group_id: string;
  uploaded_by_id: string;
  uploaded_by?: { id: string; full_name: string; email: string; photo_url: string | null };
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  suggested_visibility: string;
  suggested_user_ids: string[];
  status: SharedDocStatus;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  resulting_document_id: string | null;
  created_at: string;
}

export interface UploadPermission {
  id: string;
  user_id: string;
  group_id: string;
  granted_by_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: 'IN_APP' | 'EMAIL';
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor: { id: string; full_name: string; email: string } | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Admin attendance list row (override view — legacy)
export interface AttendanceRow {
  user: Pick<User, 'id' | 'full_name' | 'email'>;
  status: AttendanceStatus | null;
  marked_at: string | null;
  override_by: string | null;
  note: string;
}

// Session-based report types (v2)
export interface ReportRow {
  user: Pick<User, 'id' | 'full_name' | 'email'>;
  status: 'PRESENT' | 'ABSENT';
  marked_at: string | null;
}

export interface AttendanceReportData {
  session: AttendanceSession;
  records: ReportRow[];
  summary: { total: number; present: number; absent: number };
}

export interface SessionsListFilter {
  class_id?: string;
  status?: AttendanceSessionStatus;
  from?: string;
  to?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface CursorMeta {
  next_cursor: string | null;
}

