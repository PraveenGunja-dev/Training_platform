# Feature Matrix

**System:** ACLP Training Management System
**Format:** One row per feature/module with Purpose · Related files · APIs · Models · Status · Risks

---

## 1. Authentication & Identity

### F-AUTH-01 — Email + password login (JWT)
- **Purpose:** Issue access JWT (15 min) + rotating refresh (7 d) HttpOnly cookie
- **Files:** `backend/apps/accounts/views.py:LoginView`, `serializers.py:LoginSerializer`, `frontend/src/pages/auth/LoginPage.tsx`, `src/lib/api-client.ts`
- **APIs:** `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- **Models:** `User`
- **Status:** ✅ Complete
- **Risks:** No rate limiting (SECURITY_AUDIT #2)

### F-AUTH-02 — Invite flow (single + bulk CSV)
- **Purpose:** Admin invites users; 48-hour signed token + DB-persisted hash; single-use set-password
- **Files:** `backend/apps/accounts/services.py`, `apps/users/views.py:UserViewSet.invite,bulk_invite`, `frontend/src/pages/admin/UsersPage.tsx`, `src/features/admin/users/BulkInviteDialog.tsx`
- **APIs:** `POST /users/`, `POST /users/bulk-invite`, `POST /auth/set-password`
- **Models:** `User`, `PasswordSetupToken`
- **Status:** ✅ Complete (papaparse on frontend)
- **Risks:** `SetPasswordSerializer` skips `validate_password()` (SECURITY_AUDIT #3); bulk-invite runs in request path (PERFORMANCE recommendation #1)

### F-AUTH-03 — Forgot password
- **Purpose:** Email reset link
- **Files:** `apps/accounts/views.py:ForgotPasswordView`
- **APIs:** `POST /auth/forgot-password`
- **Models:** (intended `PasswordSetupToken`, but not persisted today)
- **Status:** ⚠️ Logic gap — token not persisted, single-use not enforced
- **Risks:** **High** — flow likely broken end-to-end (SECURITY_AUDIT #1)

### F-AUTH-04 — Change password
- **Purpose:** Authenticated user changes own password; invalidates all refresh tokens
- **Files:** `apps/accounts/views.py:ChangePasswordView`, `frontend/src/pages/me/ProfilePage.tsx`
- **APIs:** `POST /me/password`
- **Models:** `User`, `OutstandingToken`
- **Status:** ✅ Complete
- **Risks:** No throttle

### F-AUTH-05 — Profile photo upload
- **Purpose:** Upload/remove profile photo (multipart) → stored in Blob
- **Files:** `apps/accounts/views.py:MePhotoView`
- **APIs:** `POST/DELETE /me/photo`
- **Models:** `User.photo_url`
- **Status:** ✅ Complete
- **Risks:** MIME type client-supplied (no magic-byte sniff). `MePhotoView` allowlist excludes SVG (jpeg/png/webp/gif only) ✅; but the project-wide `ALLOWED_IMAGE_TYPES` in `apps/common/file_validation.py` does include SVG → XSS risk on documents / shared uploads (SECURITY_AUDIT #8)

## 2. User & Group Management

### F-USR-01 — User CRUD
- **APIs:** `/users/*`
- **Models:** `User`
- **Status:** ✅ Complete (filters, search, resend invite)

### F-GRP-01 — Group CRUD + membership
- **Purpose:** Create cohorts, add/remove participants, archive
- **Files:** `apps/groups/{views,serializers}.py`, `frontend/src/pages/admin/GroupsPage.tsx`, `GroupDetailPage.tsx`
- **APIs:** `/groups/*`, `/groups/{id}/participants`
- **Models:** `ClassGroup`, `GroupMembership` (unique `user+group`)
- **Status:** ✅ Complete; 8-colour card grid; analytics tab

### F-GRP-02 — Per-group analytics
- **Files:** `apps/groups/analytics.py`, `frontend/src/features/group-detail/*`
- **APIs:** `/groups/{id}/analytics`
- **Status:** ✅ Complete

## 3. Scheduling

### F-CLS-01 — Class CRUD
- **Purpose:** Schedule physical training sessions; computed status (UPCOMING / ONGOING / COMPLETED / CANCELLED); fires `CLASS_SCHEDULED` notification
- **Files:** `apps/scheduling/{views,serializers,services}.py`, `frontend/src/pages/admin/ClassesPage.tsx`, `ClassDetailPage.tsx`
- **APIs:** `/classes/*`
- **Models:** `Class`
- **Status:** ✅ Complete; reschedule emits `CLASS_RESCHEDULED`
- **Risks:** None material

### F-CLS-02 — Admin calendar (FullCalendar)
- **Files:** `frontend/src/pages/admin/CalendarPage.tsx`
- **Status:** ✅ Complete; month/week/list views

### F-CLS-03 — Participant calendar
- **APIs:** `/me/calendar?from=&to=`
- **Status:** ✅ Complete

## 4. Attendance

### F-ATT-01 — On-demand session start/end
- **Purpose:** Admin opens a session with optional `scheduled_end_at`; uniqueness enforces ≤1 active per class
- **Files:** `apps/attendance/{views,services}.py`, `frontend/src/features/admin/attendance/*`
- **APIs:** `POST /admin/attendance/sessions`, `/end`, `/report`
- **Models:** `AttendanceSession`, `AttendanceRecord`
- **Status:** ✅ Complete

### F-ATT-02 — Participant self-mark + 10s poll
- **Files:** `frontend/src/features/participant/attendance/*`
- **APIs:** `/attendance/active-session`, `/attendance/sessions/{id}/mark`
- **Status:** ✅ Complete
- **Risks:** Polling cost at scale (SCALABILITY §3.5)

### F-ATT-03 — Admin override
- **APIs:** `PATCH /admin/attendance/records/{id}`
- **Status:** ✅ Complete; audit-logged

### F-ATT-04 — Closing-soon notification
- **Files:** Celery `attendance_closing_soon_warning`
- **Status:** ✅ Complete; fires 2 min before scheduled end to unmarked participants

## 5. Assignments

### F-ASN-01 — Task CRUD + question file upload (SAS)
- **Files:** `apps/assignments/{views,serializers,storage}.py`, `frontend/src/pages/admin/AssignmentDetailPage.tsx`
- **APIs:** `/assignments/*`, `/assignments/question-upload-url`
- **Models:** `AssignmentTask`
- **Status:** ✅ Complete

### F-ASN-02 — Auto-open at deadline + reminders
- **Files:** Celery `open_due_tasks`, `send_deadline_reminders`
- **Notifications:** `TASK_OPENED`, `DEADLINE_REMINDER`
- **Status:** ✅ Complete
- **Risks:** Missing index on `upload_open_at` (PERF #2)

### F-ASN-03 — Participant submission flow
- **Files:** `apps/assignments/views.py:SubmissionViewSet`, `frontend/src/features/participant/assignments/*`
- **APIs:** `POST /assignments/{id}/upload-url`, `POST /assignments/{id}/submissions`
- **Models:** `Submission` (versioned by `task,user,version` unique)
- **Status:** ✅ Complete; STRICT / LATE_ALLOWED / ADMIN_ONLY policies

### F-ASN-04 — Admin submission review
- **Files:** `frontend/src/pages/admin/SubmissionsReviewPage.tsx`
- **Status:** ✅ Complete; download via SAS

## 6. Documents

### F-DOC-01 — Document library + visibility
- **Purpose:** Upload docs with 4 visibility modes (GROUP / SELECTED / STAFF_ONLY / PUBLIC_TO_CLASS)
- **Files:** `apps/documents/{views,serializers,permissions}.py`
- **APIs:** `/documents/*`, `/documents/upload-url`, `/documents/{id}/download`
- **Models:** `Document`
- **Status:** ✅ Complete

### F-DOC-02 — Class-linked document fires push
- **Notifications:** `CLASS_DOCUMENT_ADDED`
- **Status:** ✅ Complete

### F-DOC-03 — Participant upload permissions
- **Models:** `ParticipantUploadPermission` (unique `user+group`)
- **APIs:** `/admin/groups/{id}/upload-permissions/*`, `/me/upload-permissions`
- **Status:** ✅ Complete

### F-DOC-04 — Shared upload workflow
- **Files:** `apps/documents/views.py:GroupSharedUploadView`, `AdminSharedUploadApproveView`
- **APIs:** `/groups/{id}/shared-upload-url`, `/groups/{id}/shared-uploads`, `/admin/shared-uploads/*`
- **Models:** `ParticipantSharedDoc` (FK `resulting_document` OneToOne)
- **Notifications:** `SHARED_DOC_RESULT`
- **Status:** ✅ Complete; promote-to-library optional

## 7. Notifications

### F-NTF-01 — In-app bell + cursor inbox
- **Files:** `apps/notifications/{views,services}.py`, `frontend/src/features/notifications/*`
- **APIs:** `/notifications`, `/notifications/unread-count`, `/notifications/{id}/read`, `/notifications/read-all`
- **Models:** `Notification` (unique `dedupe_key`)
- **Status:** ✅ Complete; deep-linked
- **Notification types (12):** TASK_OPENED, DEADLINE_REMINDER, CLASS_SCHEDULED, CLASS_STARTING_SOON, CLASS_RESCHEDULED, CLASS_DOCUMENT_ADDED, CLASS_TASK_ASSIGNED, ATTENDANCE_SESSION_STARTED, ATTENDANCE_SESSION_ENDED, ATTENDANCE_CLOSING_SOON, SHARED_DOC_RESULT, GROUP_ADDED

## 8. Analytics & Dashboards

### F-ANL-01 — Admin dashboard
- **Purpose:** KPIs, 14-day trend, group analytics, recent activity, participant activity
- **Files:** `apps/analytics/views.py:AdminDashboardView`, `services.py`, `frontend/src/pages/admin/DashboardPage.tsx`, `src/features/charts/*`
- **APIs:** `/dashboard/admin`, `/dashboard/manager` (alias)
- **Models:** `DashboardSnapshot`
- **Status:** ✅ Complete

### F-ANL-02 — Participant dashboard
- **APIs:** `/dashboard/participant`
- **Status:** ✅ Complete; today's class card, pending tasks, submissions summary

### F-ANL-03 — Daily snapshot (Celery)
- **Schedule:** 02:00 UTC `aggregate_daily`
- **Status:** ✅ Complete

## 9. Audit Log

### F-AUD-01 — Append-only audit log
- **Files:** `apps/audit/{models,services,views}.py`, `frontend/src/pages/admin/AuditLogPage.tsx`
- **APIs:** `/audit?actor=&action=&target_type=&cursor=`
- **Models:** `AuditLog` (save/delete raise)
- **Status:** ✅ Complete; cursor pagination; XLSX export client-side
- **Risks:** Bulk SQL bypasses immutability (SECURITY #4)

## 10. System Settings & Health

### F-SET-01 — System settings singleton
- **Files:** `apps/common/{models,views}.py`, `frontend/src/pages/admin/SettingsPage.tsx`, `src/store/settings.ts`
- **APIs:** `/admin/settings` GET/PATCH, `/admin/settings/force-logout`
- **Models:** `SystemSettings` (pk=1)
- **Status:** ✅ Complete

### F-SET-02 — Health check
- **APIs:** `/healthz` (public)
- **Models:** `SchedulerHealth.last_heartbeat_at`
- **Status:** ✅ Complete

## 11. Frontend Cross-cutting

### F-UI-01 — shadcn/ui + Tailwind theme
- **Status:** ✅ Complete; dark navy accent default (F-X-02)

### F-UI-02 — Loading / empty / error states
- **Files:** `src/components/states/*`
- **Status:** ✅ Complete; `isError` on all pages (F-13)

### F-UI-03 — Mock API (MSW)
- **Files:** `src/mocks/*`
- **Status:** ✅ Complete; `VITE_MOCK_API=true` runs full UI without backend

### F-UI-04 — JWT refresh queue
- **Files:** `src/lib/api-client.ts`
- **Status:** ✅ Complete; thundering-herd safe

### F-UI-05 — Notification bell + deep links
- **Status:** ✅ Complete

### F-UI-06 — A11y (axe-core dev)
- **Status:** ✅ Dev-only

## 12. Status Roll-up

| Module | Backend | Frontend | E2E |
|---|---|---|---|
| Auth | ✅ | ✅ | ✅ |
| Users | ✅ | ✅ | ✅ |
| Groups | ✅ | ✅ | ✅ |
| Classes | ✅ | ✅ | ✅ |
| Attendance | ✅ | ✅ | ✅ |
| Assignments | ✅ | ✅ | ✅ |
| Documents | ✅ | ✅ | ✅ |
| Shared uploads | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ |
| Audit | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ |
| Forgot password | ⚠️ | ✅ | ❌ broken end-to-end |
| Rate limiting | ❌ | n/a | ❌ |
| Sentry / observability | ❌ | ❌ | ❌ |

## 13. Future Features (proposed roadmap)

| Priority | Feature | Effort | Value |
|---|---|---|---|
| P0 | Fix forgot-password (persist + single-use) | S | High |
| P0 | Rate limiting (login/forgot/refresh) | S | High |
| P0 | Magic-byte MIME validation; drop SVG | S | Medium-High |
| P1 | SSO (SAML / Microsoft Entra) | M | High (enterprise) |
| P1 | Sentry + structured JSON logs | S | High |
| P1 | Per-tenant isolation (multi-org) | L | High (sales) |
| P2 | Mobile responsive polish + PWA install prompt | M | Medium |
| P2 | Real-time attendance via SSE / WebSocket | M | Medium |
| P2 | Auto-grading via rubric / ML | L | Medium |
| P2 | Video conferencing (Teams) link generator | S | Medium |
| P3 | Certificate generator (PDF) | M | Low-Medium |
| P3 | Calendar export (.ics) for participants | S | Medium |
| P3 | Slack / Teams notification channel | M | Medium |
| P3 | Granular reporting (CSV/XLSX from server) | S | Medium |
| P3 | Audit log hash-chain tamper evidence | M | Compliance |
| P4 | Multi-language (i18n) | M | Low (English-only per memory) |
| P4 | Native iOS/Android | XL | Low |

---
*Module status verified against 270-test backend suite and F-01 → F-X-05 frontend milestone log.*
