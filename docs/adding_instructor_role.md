 ADMIN — Full system control

  User Management

- Invite users individually or in bulk (≤200) with role selection (backend/apps/users/views.py:103-134)
- List/search/filter all users; deactivate; update details; resend invitations
- View user detail pages (frontend/src/pages/admin/UserDetailPage.tsx)

  Group & Class Management

- Create/edit/archive class groups (backend/apps/groups/views.py:30-118)
- Bulk add/remove participants from groups
- Create/update/delete/reschedule classes; auto-notify participants (backend/apps/scheduling/views.py:42-104)

  Assignments & Submissions

- Create assignments with upload windows/deadlines (backend/apps/assignments/views.py:77-138)
- Edit/delete; manually publish (open window) and trigger notifications
- Review and download all submissions (SubmissionsReviewPage.tsx)
- Approve/reject participant shared uploads

  Attendance

- Create/start/end attendance sessions; track duration (backend/apps/attendance/views.py:36-176)
- Manually mark or override attendance records
- Generate attendance reports and analytics

  Documents

- Upload to groups/classes with visibility control (group / selected users / public-to-class)
- Manage shared-upload approval queue
- Download all documents

  Settings & Admin

- Modify system settings (singleton SystemSettings) (backend/apps/common/settings_views.py:17-29)
- Force logout all active sessions (except own)

  Analytics & Reporting

- KPI dashboard with trends/charts (DashboardPage.tsx)
- Audit logs filtered by actor/action/target/date (backend/apps/audit/views.py)
- Daily upload trends, deadline tracking, group-scoped analytics

  Calendar

- System-wide calendar of all classes/sessions (CalendarPage.tsx)

  Guard: IsAdmin permission (role == "ADMIN") + frontend RoleGuard. Admin routes live under /admin/*.

---

  PARTICIPANT — Self-scoped use

  Dashboard (/me/dashboard)

- Quick stats (attendance, pending tasks, recent submissions), today's class card

  Classes & Calendar (/me/calendar, /me/classes/:id)

- View enrolled classes only (filtered by GroupMembership)
- Read class details, description, instructors, linked materials (no edit)

  Attendance

- See active session for own groups (ActiveSessionView)
- Mark own attendance during active session only — cannot mark for others or after deadline

  Tasks/Assignments (/me/tasks, /me/tasks/:id)

- View tasks scoped to own groups via participant_task_qs()
- Filter by state (Open, Late Open, Submitted, Late Submitted, Closed, Locked)
- Download question files
- Tasks hidden until upload window opens (or admin publishes)

  Submissions (/me/submissions)

- Upload submissions before deadline only
- View status (on-time / late / admin override) and version history
- Download own previously submitted files
- Share documents with admin for approval (Pending/Approved/Rejected with reason)

  Documents (/me/documents)

- View/download only documents visible to participant's groups (visibility rules apply)
- Search and filter by document type/group

  Notifications (/me/notifications)

- View own notifications (tasks, documents, reminders)
- Mark individual or all as read; unread count; auto-delete after 30+ days

  Profile (/me)

- View/update name, email, password
- Upload avatar (JPEG/PNG/WEBP/GIF ≤5MB)
- Forgot/reset password

  Restrictions: Group-isolated; can't see others' content; can't submit past deadline; can't mark attendance for others. Only IsAuthenticated required — scoping enforced inside queryset filters.

---

  MANAGER — Removed

  The Manager role was eliminated in chunk F-X-01. User.ROLE_CHOICES now contains only ADMIN and PARTICIPANT (backend/apps/accounts/models.py:10-13). All /manager/* routes, the features/manager/ folder, and
  ManagerLayout were deleted. All former manager powers (group-scoped scheduling, submission review, shared-upload approval) were consolidated into ADMIN. Tests explicitly assert "MANAGER" not in ROLE_CHOICES.
