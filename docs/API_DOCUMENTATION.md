# API Documentation

**System:** ACLP Training Management System
**Base URL:** `https://<host>/api/v1`
**Auth:** JWT Bearer in `Authorization` header for all routes except `/auth/login`, `/auth/refresh`, `/auth/set-password`, `/auth/forgot-password`, `/healthz`.
**Schema:** Live OpenAPI 3 at `/api/schema/` · Swagger UI at `/api/docs/`
**Envelope:** `{ "data": ..., "errors": [], "meta"?: { ... } }` on every response.

---

## 1. Authentication

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | `{access, user}` + HttpOnly refresh cookie | Argon2 verify |
| POST | `/auth/refresh` | — (cookie) | `{access}` | Rotates refresh; old refresh blacklisted |
| POST | `/auth/logout` | — | 204 | Blacklists refresh; clears cookie |
| POST | `/auth/set-password` | `{token, password}` | 200 | Consumes 48h invite token (single-use) |
| POST | `/auth/forgot-password` | `{email}` | 202 always | Email enumeration mitigated |
| GET  | `/auth/me` | — | `User` | Same as `/me` |

## 2. Profile (`/me`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me` | — | User |
| PATCH | `/me` | `{full_name?, photo_url?}` | User |
| POST | `/me/password` | `{old, new}` | 204 — invalidates all outstanding refresh tokens |
| POST | `/me/photo` | multipart `photo` | `{photo_url}` |
| DELETE | `/me/photo` | — | 204 |

## 3. Admin User Management (`/users`) — Admin only

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/users/?role=&q=&cursor=` | — | paginated `User[]` |
| POST | `/users/` | `{email, full_name, role}` | User + invite email sent |
| POST | `/users/bulk-invite` | CSV file (multipart) | `{created:[], skipped:[]}` |
| GET | `/users/{id}` | — | User |
| PATCH | `/users/{id}` | partial | User |
| DELETE | `/users/{id}` | — | 204 |
| POST | `/users/{id}/resend-invite` | — | 204 — generates fresh 48h token |

## 4. Groups (`/groups`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/groups/?is_archived=&q=` | — | `ClassGroup[]` (role-scoped) |
| POST | `/groups/` | `{name, description}` | ClassGroup (Admin) |
| GET | `/groups/{id}` | — | ClassGroup + members |
| PATCH | `/groups/{id}` | partial | ClassGroup |
| DELETE | `/groups/{id}` | — | 204 (Admin) |
| POST | `/groups/{id}/participants` | `{user_ids: []}` | `GroupMembership[]` |
| DELETE | `/groups/{id}/participants/{user_id}` | — | 204 |
| GET | `/groups/{id}/analytics` | — | `{member_count, attendance_rate_14d, submission_rate, ...}` |

## 5. Classes (`/classes`, `/me/calendar`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/classes/?group=&from=&to=&status=` | — | `Class[]` |
| POST | `/classes/` | `{group, title, description, starts_at, ends_at, attendance_open_at?, attendance_close_at?, allow_late_attendance?}` | Class |
| GET | `/classes/{id}` | — | Class + participants_count |
| PATCH | `/classes/{id}` | partial | Class — emits `CLASS_RESCHEDULED` if `starts_at`/`ends_at` changed |
| DELETE | `/classes/{id}` | — | sets status=CANCELLED |
| GET | `/me/calendar?from=&to=` | — | participant-scoped `Class[]` |

## 6. Attendance

### 6.1 Admin (`/admin/attendance/*`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/admin/attendance/sessions?class=&status=` | — | `AttendanceSession[]` |
| POST | `/admin/attendance/sessions` | `{class_id, scheduled_end_at?}` | AttendanceSession — fails 409 if active session exists |
| GET | `/admin/attendance/sessions/{id}` | — | session + records |
| POST | `/admin/attendance/sessions/{id}/end` | — | session (status=ENDED) |
| GET | `/admin/attendance/sessions/{id}/report` | — | CSV-shaped JSON; one row per participant with status, marked_at |
| PATCH | `/admin/attendance/records/{id}` | `{status}` | AttendanceRecord — audit-logged override |

### 6.2 Participant

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/attendance/active-session` | — | open session for current participant or 204 |
| POST | `/attendance/sessions/{id}/mark` | — | AttendanceRecord(status=PRESENT) — 409 if session ended |

## 7. Assignments

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/assignments/?group=&class=&is_open=` | — | `AssignmentTask[]` |
| POST | `/assignments/` | `{group, class_obj?, title, question, instructions, upload_open_at, deadline_at, late_policy, reminder_offsets?, question_file_*}` | task |
| GET | `/assignments/{id}` | — | task + counts |
| PATCH | `/assignments/{id}` | partial | task |
| DELETE | `/assignments/{id}` | — | 204 (only if no submissions) |
| POST | `/assignments/{id}/close` | — | task (is_closed=True) |
| POST | `/assignments/question-upload-url` | `{file_name, content_type, file_size}` | `{upload_url, blob_name, headers}` — 15 min SAS |
| GET | `/assignments/{id}/question-download` | — | `{download_url}` |
| POST | `/assignments/{id}/upload-url` | `{file_name, content_type, file_size}` | `{upload_url, blob_name, headers}` |
| GET | `/assignments/{id}/submissions` | — | `Submission[]` (admin sees all; participant sees own) |
| POST | `/assignments/{id}/submissions` | `{blob_name, file_size, file_type, note?, on_behalf_of?}` | Submission |

### Participant helpers

| Method | Path | Returns |
|---|---|---|
| GET | `/me/tasks?status=` | participant-visible tasks (time-windowed) |
| GET | `/me/submissions` | own submissions |
| GET | `/submissions/{id}/download` | `{download_url}` |

## 8. Documents

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/documents/?group=&class=&doc_type=&visibility=` | — | `Document[]` |
| POST | `/documents/` | `{group, class_obj?, title, doc_type, visibility, allowed_user_ids?, file_url, file_name, file_type, file_size, blob_name}` | Document |
| POST | `/documents/upload-url` | `{file_name, content_type, file_size}` | `{upload_url, blob_name, headers}` |
| GET | `/documents/{id}` | — | Document |
| PATCH | `/documents/{id}` | partial | Document |
| DELETE | `/documents/{id}` | — | 204 |
| GET | `/documents/{id}/download` | — | `{download_url}` |

### Upload permissions (admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/admin/groups/{group_id}/upload-permissions/` | — | `ParticipantUploadPermission[]` |
| POST | `/admin/groups/{group_id}/upload-permissions/` | `{user_ids:[]}` | created |
| PATCH | `/admin/groups/{group_id}/upload-permissions/{user_id}` | partial | row |
| DELETE | `/admin/groups/{group_id}/upload-permissions/{user_id}` | — | 204 |

### Participant shared uploads

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me/upload-permissions` | — | `{group_id, group_name}[]` |
| GET | `/me/shared-uploads` | — | own shared docs with status |
| POST | `/groups/{group_id}/shared-upload-url` | `{file_name, content_type, file_size}` | `{upload_url, blob_name}` |
| POST | `/groups/{group_id}/shared-uploads` | `{blob_name, title, suggested_visibility, suggested_user_ids?, ...}` | ParticipantSharedDoc |
| GET | `/admin/shared-uploads/pending` | — | queue |
| POST | `/admin/shared-uploads/{id}/approve` | `{promote?: bool, override_visibility?}` | ParticipantSharedDoc + Document |
| POST | `/admin/shared-uploads/{id}/reject` | `{rejection_reason}` | ParticipantSharedDoc |

## 9. Notifications

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/notifications?cursor=&read=` | — | `Notification[]` + `meta.next_cursor` |
| GET | `/notifications/unread-count` | — | `{count}` |
| POST | `/notifications/{id}/read` | — | Notification |
| POST | `/notifications/read-all` | — | `{updated}` |

12 notification types: `TASK_OPENED`, `DEADLINE_REMINDER`, `CLASS_SCHEDULED`, `CLASS_STARTING_SOON`, `CLASS_RESCHEDULED`, `CLASS_DOCUMENT_ADDED`, `CLASS_TASK_ASSIGNED`, `ATTENDANCE_SESSION_STARTED`, `ATTENDANCE_SESSION_ENDED`, `ATTENDANCE_CLOSING_SOON`, `SHARED_DOC_RESULT`, `GROUP_ADDED`.

## 10. Dashboard / Analytics

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/dashboard/admin` | Admin | `{kpis, trend_14d[], by_group[], recent_activity[], participant_activity[]}` (served from `DashboardSnapshot` if same day) |
| GET | `/dashboard/manager` | Admin | alias for admin dashboard (legacy compatibility) |
| GET | `/dashboard/participant` | Authenticated | `{today_class, pending_tasks, submissions_summary, attendance_rate}` |

## 11. Audit Log (`/audit`) — Admin only

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/audit` | `actor=&action=&target_type=&from=&to=&cursor=` | `AuditLog[]` + `meta.next_cursor` |

Append-only; no POST/PATCH/DELETE exposed.

## 12. Settings & Health

| Method | Path | Auth | Body / Returns |
|---|---|---|---|
| GET | `/admin/settings` | Admin | SystemSettings singleton |
| PATCH | `/admin/settings` | Admin | partial → SystemSettings |
| POST | `/admin/settings/force-logout` | Admin | invalidates all sessions |
| GET | `/healthz` | Public | `{status, db, redis, scheduler:{last_heartbeat_at}}` |

## 13. Dev-only endpoints (DEBUG=True)

| Method | Path | Purpose |
|---|---|---|
| PUT | `/dev/upload/{blob_name}` | Local sink replacing Azure Blob |
| GET | `/dev/download/{blob_name}` | Local read |

⚠️ Must be disabled in production (gated by `DEBUG` flag). See SECURITY_AUDIT.md.

## 14. Error Shapes

```json
{
  "data": null,
  "errors": [
    { "code": "validation_error", "field": "deadline_at", "detail": "must be in the future" }
  ]
}
```

Standard HTTP status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 500.

## 15. Pagination

- **Cursor** (Notifications, Audit): `?cursor=<iso8601>` → `meta.next_cursor` / `meta.previous_cursor`
- **Offset/Limit** (everything else): `?page=&page_size=` (max 100); response `meta.total_count`

## 16. Rate Limits

⚠️ **None currently enforced** at the application layer. Recommendation in SECURITY_AUDIT.md to add `nginx limit_req` (login: 5/min/IP) + `django-ratelimit` on forgot/refresh/change-password.

---
*Verified against `backend/config/urls.py` and `backend/apps/*/urls.py` on 2026-05-28.*
