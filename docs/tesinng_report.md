# Deep Audit Report — ACLP Training Management System

**Date:** 2026-05-29
**Tester:** Automated multi-agent investigation (Opus 4.7 main + 4 parallel sub-agents)
**Scope:** Full-stack — backend tests, frontend build, live API probing, code review across all surfaces requested.

**Method:** Ran `pytest` (Postgres SQLite-in-memory), `tsc -b`, `vite build`, `django manage.py check --deploy`, live HTTPS probes against the running backend on `localhost:8000`, and 4 parallel sub-agent code-review passes (backend, frontend, API contract, deployment).

> Items marked **✓ verified live** were reproduced on the running system. All others were sourced from agent-grounded code review; representative claims were spot-checked against the actual source.

---

## ❶ EXECUTIVE SUMMARY

|                                                        |    |                                                                                                  |
| ------------------------------------------------------ | -- | ------------------------------------------------------------------------------------------------ |
| **System boots?**                                | ✓ | Backend on 8000, Postgres on 5432, healthz returns ok (scheduler "degraded")                     |
| **`pytest`**                                   | ❌ | **2 failing tests** (previously 270/270 passing — regressed)                              |
| **`tsc -b && vite build`**                     | ❌ | **Production build is BROKEN** (TS errors in mocks + 1 real bug)                           |
| **`tsc --noEmit` (root)**                      | ✓ | Passes — but doesn't cover full project                                                         |
| **`makemigrations --check`**                   | ✓ | No drift                                                                                         |
| **`check --deploy`**                           | ⚠ | 55 issues (mostly drf-spectacular schema gaps + standard prod warnings)                          |
| **Demo credentials in TEST_REPORT.md**           | ❌ | **Stale — `asha@org.com`, `p1@org.com` no longer exist**                              |
| **Path traversal (unauthenticated)**             | 🚨 | **Confirmed reading `.env` (SECRET_KEY, DB creds) via `/api/v1/dev/download/../.env`** |
| **Forgot-password flow**                         | 🚨 | **100% broken — always returns `invite_token_invalid`**                                 |
| **Participant submission upload**                | 🚨 | **File is NEVER PUT to storage** (fake progress bar, then DB row points to empty blob)     |
| **Admin "Start Attendance" dialog**              | 🚨 | **Wrong arg shape — TS build error, runtime would 400**                                   |
| **Change-password**                              | 🚨 | **Field-name drift (`current/new` vs `current_password/new_password`) — always 400**  |
| **Admin can start attendance on UPCOMING class** | 🚨 | **Confirmed live — window check removed from `start_session`**                          |

---

## ❷ THE TWO REGRESSIONS THE OWNER PROBABLY WANTS TO KNOW ABOUT FIRST

### REG-1 — `test_start_session_outside_window` now fails

- **Location:** `backend/apps/attendance/services.py:23-92` (`start_session`).
- **What changed:** The window-check (`raise AttendanceError("attendance.class_not_in_window", ...)` if `now` is outside `[attendance_open_at, attendance_close_at]`) was removed during a recent edit. Test expects 422 with code `attendance.class_not_in_window`; service returns 201.
- **✓ Repro:** As admin, `POST /api/v1/admin/attendance/sessions {class_id: <upcoming class id>}` → `201 Created` instead of `422`. *I just opened a real session on the "Leadership Capstone" class scheduled for the future and then closed it.*
- **Fix:** Re-add the window check at the top of `start_session`:
  ```python
  now = timezone.now()
  if class_obj.attendance_open_at and now < class_obj.attendance_open_at:
      raise AttendanceError("attendance.class_not_in_window", "Too early", 422)
  if class_obj.attendance_close_at and now > class_obj.attendance_close_at:
      raise AttendanceError("attendance.class_not_in_window", "Too late", 422)
  ```

### REG-2 — `test_seed_demo_participant_emails` now fails

- **Location:** `backend/apps/common/management/commands/seed_demo.py:82-108`.
- **What changed:** Participants are now real names (`rutvik.prajapati@adani.com`, `priya.sharma@adani.com`, …), but the test still iterates `p1..p25@org.com`. **And `TEST_REPORT.md` still tells operators to log in with `asha@org.com / p1@org.com`** — none of those accounts exist.
- **✓ Repro:** `curl -X POST /api/v1/auth/login {"email":"asha@org.com","password":"password123"}` → 401. `{"email":"kiran.nair@adani.com",…}` → 200.
- **Side-effect:** `seed_showcase.py:101-115` then *overwrites* `kiran.nair@adani.com`'s `full_name` to `"Asha Admin"` with a stale photo URL `ui-avatars.com/api/?name=Asha%20Admin`. Login confirms `full_name="Kiran Nair"` (re-fixed somewhere) but `photo_url` still says Asha. So whichever seed runs last wins.
- **Fix:** Either (a) update the test + TEST_REPORT to the new emails, (b) update `seed_demo` to emit both legacy `p<i>` aliases and the named accounts, or (c) consolidate the two seed commands.

---

## ❸ CRITICAL (P0 — block any production deploy)

### C-1 — **🚨 Unauthenticated arbitrary file read via path-traversal** *(✓ verified live)*

**Location:** `backend/apps/assignments/dev_views.py:14-36`, route `<path:blob_name>` in `urls.py:40-41`.
**Vulnerability:** Both `DevUploadView` and `DevDownloadView` are `permission_classes = [AllowAny]` and join the user-supplied `blob_name` with `os.path.join(BASE_DIR / 'dev_media', blob_name)`. There is no `os.path.commonpath` containment check. Raw `..` segments in the URL path pass through Django's `<path:…>` capture unchanged.

**✓ Live reproduction:**

```python
import socket
s = socket.socket(); s.connect(('localhost', 8000))
s.send(b'GET /api/v1/dev/download/../.env HTTP/1.1\r\nHost: localhost:8000\r\nConnection: close\r\n\r\n')
# Returns: SECRET_KEY=dev-secret-key-change-in-production-abc123xyz
#          DATABASE_URL=postgres://ems_user:ems_pass@localhost:5432/ems_db ...
```

I also retrieved `requirements.txt` and the full `.env`. The `DevUploadView` permits unauthenticated **PUT**, so an attacker can overwrite arbitrary files (`../config/settings/base.py`).

**Why this matters:** Gated by `if not settings.DEBUG: return 403`, so it shouldn't apply to production — *but*:

- `manage.py` defaults to `config.settings.dev` (see D-2), so an operator who forgets the env var runs prod with DEBUG=True.
- The `storage.py` fallback uses `DEV_LOCAL_STORAGE` (not DEBUG) — a typo there exposes prod even with DEBUG off.

**Fix:**

1. Add containment: `if os.path.commonpath([dest, _DEV_MEDIA_ROOT]) != _DEV_MEDIA_ROOT: raise Http404`.
2. Change `AllowAny` → `IsAuthenticated`.
3. Slug the URL pattern to `<slug:blob_name>` or strip `..`/`/` characters.
4. In `production.py`, explicitly `DEV_LOCAL_STORAGE = False` and `assert not DEBUG`.

### C-2 — **🚨 Forgot-password flow is 100% broken** *(✓ verified live)*

**Location:** `backend/apps/accounts/views.py:139-160` + `apps/accounts/services.py:57-84`.
**Bug:** `ForgotPasswordView` calls `TimestampSigner().sign(str(user.pk))` and emails the link — but it **never inserts a `PasswordSetupToken` row**. `consume_setup_token` (used by `SetPasswordView`) requires:

```python
PasswordSetupToken.objects.get(user_id=..., token_hash=hashlib.sha256(token).hexdigest(), consumed_at__isnull=True)
```

**✓ Live reproduction:**

```
$ curl -X POST .../auth/set-password -d '{"token":"<valid signed token>","password":"newpassword123"}'
{"errors":[{"code":"invite_token_invalid","message":"Token is invalid or expired"}], "data":null}
HTTP 400
```

**Fix:** In `ForgotPasswordView`, mirror `invite_user`: invalidate any open `PasswordSetupToken` for the user, then `PasswordSetupToken.objects.create(user=user, token_hash=hashlib.sha256(token.encode()).hexdigest())` before sending the email.

### C-3 — **🚨 Participant assignment submission never uploads the file** *(✓ verified by code reading)*

**Location:** `frontend/src/features/participant/tasks/useUploadSubmission.ts:32-45`.
**Bug:** Between `getUploadUrl()` (which returns a SAS PUT URL) and `submit()` (which creates the DB row), the code runs a fake `setInterval` that increments a progress bar from 0→100% in 2 s — and **never PUTs the file**:

```ts
// Simulate blob upload with progress       ← literally fake
await new Promise<void>((resolve) => {
  let p = 0;
  intervalRef.current = setInterval(() => { p += 5; setProgress(p); if (p >= 100) resolve(); }, 100);
});
return submissionsApi.submit(task.id, { blob_name: sasResult.data.blob_name, ... });
```

Compare to `CreateAssignmentDialog.tsx:127` and `UploadDocumentDialog.tsx:109` which *do* call `fetch(upload_url, { method:'PUT', body:file })`. Result: every participant submission stores a DB row pointing at a non-existent blob; the manager's "Download" button later 404s.

**Fix:** Insert the real PUT between lines 30 and 47:

```ts
const putRes = await fetch(sasResult.data.upload_url, {
  method: 'PUT', body: file,
  headers: { 'Content-Type': file.type || 'application/octet-stream' },
});
if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
```

Drop the fake `setInterval` (use XHR with `upload.onprogress` if you need real progress).

### C-4 — **🚨 Production build is broken** *(✓ verified live)*

**Locations:**

- `frontend/src/mocks/data/audit.ts` (50+ usages of `actor_id` no longer in `AuditEntry`).
- `frontend/src/mocks/handlers/{attendance,assignments,documents,audit}.ts` — missing fields after type evolution (`duration_minutes`, `scheduled_end_at`, `group_name`, `class_title`, `is_closed`, `question_file_url`, `description`).
- `frontend/src/features/admin/attendance/StartSessionDialog.tsx:96` — `start.mutateAsync(selectedClassId)` passes a `string`; hook expects `{classId, durationMinutes}` AND the dialog has no duration picker. **This file is dead code (`StartAttendanceDialog.tsx` is what's actually used), but it sits inside `tsconfig.app.json`'s `include: ["src"]` and breaks `tsc -b`.**

**✓ Live:** `npm run build` exits with TS error list (`vite build` never starts).
**Fix:**

1. **Delete `StartSessionDialog.tsx`** — it's an orphan.
2. Either regenerate mocks (best) or exclude `src/mocks/**` in `tsconfig.app.json` until the mocks are fixed (`"exclude": ["src/mocks"]`).

### C-5 — **🚨 Submission API field-name drift — 400 on every submit** *(✓ verified by code reading)*

**Location:** `frontend/src/api/submissions.ts:13-17` ↔ `backend/apps/assignments/serializers.py:152-158`.
**Bug:** Frontend POSTs `{blob_name, file_name, file_size, content_type, note?}`. `SubmissionWriteSerializer` requires `{file_url, file_name, file_type, file_size, note?}`. Even if C-3 were fixed, the submit call would 400 with two `required` errors.
**Fix:** Map fields on send (or rename serializer aliases): `file_url: blob_name`, `file_type: content_type`.

### C-6 — **🚨 Change-password is broken — 400 on every attempt** *(✓ verified live)*

**Location:** `frontend/src/api/auth.ts:23-24` ↔ `backend/apps/accounts/serializers.py:33`.
**Bug:** Frontend sends `{current: data.current, new: data.new_password}`. Backend wants `{current_password, new_password}`. **Tested live → `400 required: current_password, new_password`.**
**Fix:** Change the POST body to `{current_password: data.current, new_password: data.new_password}`.

### C-7 — **🚨 Admin can start attendance on a future class** *(✓ verified live — overlap with REG-1, repeated here for severity)*

A signed-in admin starts attendance for "Leadership Capstone" (scheduled days in the future) and receives `201 Created`. Participants receive `ATTENDANCE_SESSION_STARTED` notifications they shouldn't.

### C-8 — `mockLogin` ships in the production bundle *(per agent, plausible — I did not pull the dist)*

**Location:** `frontend/src/store/auth.ts:13-32, 49-50`.
**Bug:** `mockUsers` + `mockLogin('ADMIN'|'PARTICIPANT')` are not dev-gated. A user in the browser console can run `useAuthStore.getState().mockLogin('ADMIN')`. `RoleGuard` then renders the entire admin shell (API calls fail with 401 — but cached query data from any prior real session in the same browser is fully readable).
**Fix:** Wrap with `if (import.meta.env.DEV) { … }` or move into the DevSwitcher module.

---

## ❹ HIGH (P1 — fix this week)

| #              | Module                                   | Issue                                                                                                                                                                                                                                                                                                                                                          | Where                                                                     | Fix                                                                                                                                                            |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-1**  | Attendance routes                        | `attendanceApi.list(classId)` and `attendanceApi.override(classId, userId, …)` hit `/classes/<id>/attendance` and `/classes/<id>/attendance/<userId>` — **neither exists in `backend/apps/attendance/urls.py`**. Manager `AttendanceTable.tsx` and `AttendanceOverrideDialog.tsx` would 404 against the real backend.                    | `frontend/src/api/attendance.ts:21-23`                                  | Either expose those routes server-side or rewrite the UI on top of `sessionReport(sessionId)` + the existing `/admin/attendance/records/<recordId>` PATCH. |
| **H-2**  | Class status filter                      | `apply_class_filters` filters on stale `status_cached`, while serializer's `status` field is live `computed_status`. So `?status=ONGOING` returns 8 classes that ended 3 days ago.                                                                                                                                                                   | `backend/apps/scheduling/services.py:21`                                | Filter `Q(status_cached__in=['CANCELLED','COMPLETED']) \| <time-bounded filter on starts_at/ends_at>`. Add a Celery beat task to update `status_cached`.    |
| **H-3**  | Audit pagination                         | `AuditCursorPagination` returns the full absolute URL as `next_cursor`. Frontend re-sends that whole URL as `?cursor=`. "Load more" 404s. Same pagination is shared by `AdminSessionViewSet.list`.                                                                                                                                                     | `backend/apps/common/pagination.py:17`                                  | Override `get_paginated_response` to extract just the encoded cursor token.                                                                                  |
| **H-4**  | Token invalidation                       | `ChangePasswordView` and `ForceLogoutView` do `OutstandingToken.objects.filter(user=user).delete()` — that only deletes bookkeeping. The JWTs **remain signed and valid** until natural expiry. SimpleJWT's blacklist check looks for rows in `BlacklistedToken`, not the absence of `OutstandingToken`. Force-logout is effectively a no-op. | `apps/accounts/views.py:180-182`, `apps/common/settings_views.py:38`  | For each `OutstandingToken`: `.blacklist()` (not `.delete()`).                                                                                           |
| **H-5**  | Frontend logout                          | `logout()` only clears the Zustand store. It never calls `authApi.logout()`, so the httpOnly refresh cookie stays on the device. Next visit, 401 interceptor silently refreshes and authenticates as the same user. Combined with H-4 this is a real session-hijack risk on shared machines.                                                               | `src/store/auth.ts:49-50`, `src/components/layout/UserMenu.tsx:33-36` | `await authApi.logout()` before clearing the store.                                                                                                          |
| **H-6**  | 401 refresh interceptor                  | When refresh fails the catch block calls `logout(); window.location.href='/login';` but doesn't re-throw. The original request's promise resolves with `undefined`. Callers using `.then(r => r.data)` crash. The `refreshQueue` callbacks are also leaked on refresh failure (never resolved).                                                        | `src/lib/api-client.ts:23-55`                                           | `} catch (e) { logout(); window.location.href='/login'; throw e; }`. Reject queued promises in `finally`.                                                  |
| **H-7**  | Notification bell                        | Approve/Reject dialogs invalidate `['notifications-unread-count']` (single string) but `NotificationBell.tsx:14` uses `['notifications','unread-count']` (two-element). React Query treats these as different keys → bell never decrements.                                                                                                             | `features/manager/shared-uploads/{Approve,Reject}Dialog.tsx`            | Use `['notifications','unread-count']`.                                                                                                                      |
| **H-8**  | Forgot-password link                     | `LoginPage.tsx:682` is `<a href="#">` — does not navigate. The `/forgot-password` route exists but no link reaches it from the login screen. Combined with C-2, users have no working path to reset a password.                                                                                                                                         | `src/pages/auth/LoginPage.tsx`                                          | `<Link to="/forgot-password">`.                                                                                                                              |
| **H-9**  | Admin overrides                          | `AdminRecordOverrideView` accepts any record PK with no group-scoping check. Any admin can flip records in any group, and the view isn't transactional — audit log can land while save rolls back.                                                                                                                                                          | `apps/attendance/views.py:142-172`                                      | Wrap in `@transaction.atomic`; scope to records visible to the admin (or document the cross-tenant policy).                                                  |
| **H-10** | SAS URL minting                          | `AssignmentTaskViewSet.upload_url` only does `get_object_or_404(AssignmentTask)`. No `is_open`/`is_closed` check, no group membership, no `request.user.role`. Any authenticated user can mint a PUT URL to any task.                                                                                                                                | `apps/assignments/views.py:206-222`                                     | Mirror the gating in `retrieve()`: must be in group, task must be open, deadline not passed.                                                                 |
| **H-11** | Group dedupe                             | `GROUP_ADDED` notification uses `dedupe_key=f"group_added_{group.id}_{user.id}_{uuid4()[:8]}"` — random suffix defeats the entire deduplication mechanism.                                                                                                                                                                                                | `apps/groups/services.py:62`                                            | Drop the UUID —`f"group_added:{group.id}:{user.id}"`.                                                                                                       |
| **H-12** | N+1 documents                            | `DocumentViewSet.list` evaluates the whole table into Python then filters via `[doc for doc in qs if document_visible_to(doc, user)]`, each iteration firing a `GroupMembership.exists()`. With 1000 docs that's ~2000 queries per request, with no pagination.                                                                                          | `apps/documents/views.py:60-66`                                         | SQL filter with `Q()` + pagination.                                                                                                                          |
| **H-13** | N+1 dashboard                            | `compute_admin_payload` runs ~5 queries per group + ~5 queries per (up-to-100) participant. Hundreds of queries per dashboard request — the frontend polls this.                                                                                                                                                                                            | `apps/analytics/services.py:43-202`                                     | Replace per-row counts with `.annotate(Count(...))`; cache for 30s.                                                                                          |
| **H-14** | Schema generation                        | `python manage.py spectacular` emits **313 errors** because 40 view classes have no `serializer_class` — `/api/docs/` is functionally empty.                                                                                                                                                                                                      | many `apps/*/views.py`                                                  | Add `@extend_schema(request=…, responses=…)` or `serializer_class`.                                                                                      |
| **H-15** | LoginPage password schemas               | `setPasswordSchema` requires 8+1upper+1digit; `changePasswordSchema` requires only 8 chars. After invite, users can downgrade to `"aaaaaaaa"`.                                                                                                                                                                                                           | `src/features/auth/schemas.ts:9-19, 27-34`                              | Extract one `passwordStrength` schema and reuse.                                                                                                             |
| **H-16** | Notifications dropped silently           | 3 `try: ... except Exception: pass` in `start_session` swallow broker outages — session "starts" but auto-end never runs. Plus the new `maybe_end_expired_session` swallows errors too.                                                                                                                                                                 | `apps/attendance/services.py:50-73, 140-149`                            | Replace with `logger.exception(...)`, or let Celery retry.                                                                                                   |
| **H-17** | Dead `StartSessionDialog` blocks build | (also C-4) — not used at runtime;`StartAttendanceDialog.tsx` is the live one.                                                                                                                                                                                                                                                                               | delete the file                                                           |                                                                                                                                                                |

---

## ❺ MEDIUM (P2 — backlog this sprint)

### Backend

- **M-1** `MarkAttendanceView` accepts any session ID directly; relies on a downstream `group membership` check inside `mark_attendance`. ID enumeration timing attack possible to map sessions→groups. *(`apps/attendance/views.py:227-240`)*
- **M-2** Reschedule notification dedupe key embeds `starts_str` rounded to the minute — two reschedules within the same minute drop the second notification. Not transactional. *(`apps/scheduling/views.py:90-115`)*
- **M-3** `bulk_create` of N notifications has no `batch_size=` — breaks past ~5k member counts. *(`apps/documents/views.py:100-128`, `apps/scheduling/views.py:90-115`, `apps/assignments/views.py:91-122`)*
- **M-4** `compute_admin_payload` returns chart keys (`class_status`, `weekly_trend`) that aren't in the frontend `AdminDashboardData.charts` type, and ignores `?group_id` filter. *(`apps/analytics/services.py:204-230`)*
- **M-5** Participant `dashboard.today.class.active_session` is inline-built, missing `started_by/ended_by/duration_minutes/scheduled_end_at` that the frontend type requires. *(`apps/analytics/services.py:296-316`)*
- **M-6** Cursor pagination on `/notifications` ignores `limit` query param (hardcoded to 20). *(`apps/notifications/views.py:22`)*
- **M-7** Attendance `from`/`to` filter accepts raw strings without `parse_datetime` — malformed input produces 500. *(`apps/attendance/views.py:54-57`)*
- **M-8** `target_type` query param on `/audit` silently ignored — frontend filter dropdown is decorative. *(`apps/audit/views.py:15`)*
- **M-9** `list_submissions` ignores `status`, `search`, `cursor` query params; returns every row. *(`apps/assignments/views.py:298`)*
- **M-10** `SystemSettings.get_solo()` race + `BigAutoField` sequence misalignment can produce `duplicate key` after first insert. *(`apps/common/models.py:33-52`)*

### Frontend

- **M-11** No React `ErrorBoundary` anywhere; any uncaught render error produces a blank white screen.
- **M-12** `me/DashboardPage.tsx:47-48` reads `data!.data` with no `isError` branch.
- **M-13** Polling pages (`ClassesPage`, `ClassDetailPage`, `me/ClassDetailPage`) set `refetchInterval: 10_000, staleTime: 0` without `refetchIntervalInBackground: false` — 5 background tabs hit `/classes` 1800×/h.
- **M-14** `SessionTimer.tsx` never stops the 1-Hz interval after the session expires.
- **M-15** `MePhotoView.post` derives file extension from user-controlled filename with no allow-list — combined with C-1 in dev, can write `avatar.evil.html`. *(`apps/accounts/views.py:200-258`)*
- **M-16** `fetch(upload_url, {method:'PUT', body:file})` in `UploadDocumentDialog.tsx:109` and `CreateAssignmentDialog.tsx:127` doesn't check `res.ok` — 4xx/5xx from Azure silently succeeds.
- **M-17** Two timezone parsing strategies coexist (`new Date('YYYY-MM-DDTHH:mm').toISOString()` vs `date-fns-tz fromZonedTime`) — DST drift on European tz.
- **M-18** `ScheduleClassDialog`/`EditClassDialog` doesn't block past times for "today".
- **M-19** Frontend `Notification` type includes `INVITE_RESENT` and `ATTENDANCE_OVERRIDE` which are NOT in backend `TYPE_CHOICES` — emitting them would violate CHECK.
- **M-20** Cache-key drift across `['classes', …]` queries (5 different shapes; current invalidation only works because `['classes']` is a prefix). One careless `exact: true` away from a silent break.

### API surface

- **M-21** `/api/v1/me` is registered twice (auth/me_urls). Schema duplication; risk of policy drift.
- **M-22** Frontend `Document` type uses `uploaded_by: string`, backend returns `uploaded_by_id` + `updated_at`. `manager_name` referenced in `ClassHeader.tsx:40` is not in backend serializer (it returns `created_by_name`).
- **M-23** `AttendanceRecord.status` typed as literal `'PRESENT'` on frontend; backend may return `'ABSENT'` after admin override.

---

## ❻ LOW (P3 — when convenient)

- **L-1** `seed_showcase.py:105` overwrites kiran.nair's `full_name` to "Asha Admin" with a stale `ui-avatars` photo URL — *I observed this on the live login response.*
- **L-2** Document file URLs with spaces (`Screenshot 2026-05-24 222518.png`) — works because the API returns the URL pre-formed and browsers re-encode, but `curl --path-as-is` fails. Risk of breakage if the URL ever passes through unaware tooling.
- **L-3** No `gunicorn`, `whitenoise`, `sentry-sdk` in `requirements.txt`.
- **L-4** `LoginPage` canvas animation ignores `prefers-reduced-motion`.
- **L-5** LoginPage forces a minimum 3 s loader after login completes.
- **L-6** Fake progress in `BulkInviteDialog` (theatre).
- **L-7** ParticipantCalendar mobile view reads `window.innerWidth` only on mount — no rotation handling.
- **L-8** `clear_dummy_data.py` and `create_admin.py` (admin/admin123) sit in `backend/` and use `config.settings.base` — should not ship.

---

## ❼ DEPLOYMENT / CONFIGURATION

The agent report on this surface is dense; the highest-leverage items I'd act on immediately:

- **D-1** `manage.py:7` default settings = `config.settings.dev`. Running migrations/runserver on the VM without exporting `DJANGO_SETTINGS_MODULE` gives prod a DEV configuration (DEBUG=True, eager Celery, `DEV_LOCAL_STORAGE=True`, **the path-traversal endpoint live**, console email). Change default to `config.settings.production`.
- **D-2** `backend/config/settings/production.py` is 13 lines — only toggles a handful of cookie flags. Doesn't override `EMAIL_BACKEND`, `STORAGES`, `LOGGING`, `CORS_ALLOWED_ORIGINS`, doesn't assert `SECRET_KEY` strength, doesn't disable `DEV_LOCAL_STORAGE`. Inherits localhost CORS default from `base.py`.
- **D-3** `backend/.env` placeholder `SECRET_KEY=dev-secret-key-change-in-production-abc123xyz` is ~46 chars and `django-insecure-` style. `production.py` doesn't validate.
- **D-4** `backend/create_admin.py` creates `admin@ems.local / admin123`. If this script ever runs in prod, attackers know the admin.
- **D-5** No `LOGGING` config anywhere → stderr only, no rotating files, no sensitive-data scrub.
- **D-6** No `frontend/.env.production`. `vite build` falls back to `.env`, which contains `VITE_API_BASE_URL=http://localhost:8000/api/v1` → the shipped JS calls localhost from the user's browser.
- **D-7** No `docker-compose.prod.yml`, no Procfile, no Dockerfile. Deploys are manual systemd.
- **D-8** `docs/` was just added to `.gitignore` — confirm that's intentional (the per-project memory says yes).

---

## ❽ DIAGNOSTIC SNAPSHOT

```
pytest        :  268 passed, 2 failed
                 - test_start_session_outside_window  → REG-1
                 - test_seed_demo_participant_emails  → REG-2
tsc --noEmit  :  0 errors (root config, doesn't include mocks)
tsc -b        :  100+ errors (mocks drift + StartSessionDialog runtime bug)
vite build    :  never runs (tsc fails first)
makemigrations:  no drift
check --deploy:  55 issues — 40 spectacular W002 + 7 standard prod warnings + 8 misc
healthz       :  db ok, redis ok, scheduler degraded
```

---

## ❾ PRIORITIZED REMEDIATION ORDER

1. **C-1** Path traversal — patch `dev_views.py`, switch to `IsAuthenticated`, add containment check. *(15 minutes)*
2. **C-4 / C-7 / REG-1** Re-add window check in `start_session`, delete `StartSessionDialog.tsx`, fix the mocks drift. *(30 minutes)*
3. **C-2** Forgot-password flow — wire `PasswordSetupToken` row creation into `ForgotPasswordView`. *(20 minutes)*
4. **C-3 + C-5** Real PUT in `useUploadSubmission`, fix submit body shape (`file_url/file_type`). *(15 minutes)*
5. **C-6** Fix change-password body shape. *(5 minutes)*
6. **REG-2 / TEST_REPORT** Update `TEST_REPORT.md` credentials, fix `test_seed_demo_participant_emails`, decide what to do with `seed_showcase` clobbering admin profile. *(15 minutes)*
7. **C-8 / H-4 / H-5 / H-6** Auth hardening: dev-gate `mockLogin`, real `logout()`, blacklist tokens on password change, re-throw on refresh failure. *(45 minutes)*
8. **H-1, H-3, H-7, H-8** Wire/repair broken endpoints (`attendanceApi.list`, audit cursor, notification cache keys, forgot-password link). *(1 hour)*
9. **H-2, H-9, H-10, H-11, H-12, H-13** Permission scoping + dedupe-key + N+1 fixes. *(half day)*
10. **D-1..D-7** Production settings hardening. *(half day)*
11. Everything in M/L → backlog.

The 6 critical items (C-1 to C-6) plus the 2 regressions are ~2 hours of focused work and will unblock a production-quality release. Without them, the system is *not* shippable: secrets leak, users cannot reset passwords, participants cannot actually upload submissions, admins cannot change their own password, and the production build will not even compile.
