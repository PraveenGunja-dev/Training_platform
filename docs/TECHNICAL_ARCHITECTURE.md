# Technical Architecture

**System:** ACLP Training Management System
**Style:** Monolithic Django REST API + SPA frontend + Celery worker on a single Azure VM
**Revision:** 2026-05-28

---

## 1. Architecture Overview (C4 Level 2)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              END USER (Browser)                            │
│                       Chrome / Edge / Firefox / Safari                     │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │  HTTPS 443 (Bearer JWT + HttpOnly refresh cookie)
                                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       AZURE VM  ─  Standard_D2s_v3 / Ubuntu 22.04          │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │            NGINX (reverse proxy, TLS terminator)                  │    │
│   │   • /            → static SPA build (dist/)                       │    │
│   │   • /api/v1/*    → unix socket → Gunicorn                         │    │
│   │   • /admin/      → Django admin (firewall-gated)                  │    │
│   └─────────────────────────────┬────────────────────────────────────┘    │
│                                 │                                          │
│   ┌─────────────────────────────▼────────────────────────────────────┐    │
│   │       GUNICORN  (3 sync workers, unix socket)                     │    │
│   │       Django 5 + DRF 3.15 + simple-jwt                            │    │
│   │       ─ apps.accounts ──── auth, invite, change-password          │    │
│   │       ─ apps.users    ──── admin user management ViewSet          │    │
│   │       ─ apps.groups   ──── ClassGroup, GroupMembership            │    │
│   │       ─ apps.scheduling ── Class, /me/calendar                    │    │
│   │       ─ apps.attendance ── sessions, records, override            │    │
│   │       ─ apps.assignments ─ AssignmentTask, Submission, SAS        │    │
│   │       ─ apps.documents ─── Document, shared uploads               │    │
│   │       ─ apps.notifications  in-app bell, cursor pagination        │    │
│   │       ─ apps.analytics ──── dashboard payloads, snapshots         │    │
│   │       ─ apps.audit    ──── append-only AuditLog                   │    │
│   │       ─ apps.common   ──── settings, health, permissions          │    │
│   └─────────────────────────────┬────────────────────────────────────┘    │
│                                 │                                          │
│   ┌──────────────────┐  ┌──────▼──────────┐  ┌──────────────────────┐    │
│   │  CELERY WORKER   │  │  CELERY BEAT     │  │  POSTGRES (Azure)    │    │
│   │  systemd ems-    │  │  systemd ems-    │  │  DB Flex Server B2s  │    │
│   │  worker          │  │  beat            │  │  schema: ems         │    │
│   └─────────┬────────┘  └────────┬─────────┘  └─────────┬────────────┘    │
│             │                    │                       │                 │
│             └────────────┬───────┘                       │                 │
│                          ▼                               │                 │
│                ┌────────────────────┐                    │                 │
│                │   REDIS 7 (Docker) │◀───────────────────┘                 │
│                │   db0 cache + JWT blacklist             │                 │
│                │   db1 celery broker                     │                 │
│                │   db2 celery results                    │                 │
│                └────────────────────┘                                      │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │  SAS URL (15-min, scoped)
                                     ▼
                       ┌──────────────────────────────┐
                       │  AZURE BLOB STORAGE          │
                       │  container: ems-prod         │
                       │  prefixes:                   │
                       │   • questions/{uuid}/        │
                       │   • submissions/{uuid}/v{n}/ │
                       │   • documents/{uuid}/        │
                       │   • shared-uploads/{uuid}/   │
                       │   • photos/{uuid}/           │
                       └──────────────────────────────┘
```

## 2. Component Inventory

### 2.1 Frontend (React SPA)
- **Build:** Vite 5.4 → `dist/` (gzip ~568 KB)
- **Entry:** `src/main.tsx` → `<App />` with `QueryClientProvider` + `BrowserRouter`
- **Router:** `src/router/index.tsx` — `RootRedirect`, `RoleGuard`, lazy-imported pages
- **HTTP:** `src/lib/api-client.ts` — Axios instance with request interceptor (Bearer) and response interceptor (401 → queued refresh → retry; thundering-herd safe)
- **State:**
  - Server: TanStack Query 5.59 (caching, invalidation per mutation)
  - Client: Zustand 5 with `persist` middleware (`ems-auth`, `ems-settings`)
- **Forms:** React Hook Form + Zod schemas
- **UI:** Tailwind + shadcn/ui (Radix primitives), Framer Motion 11, Lucide icons, Sonner toasts
- **Domain widgets:** FullCalendar 6 (admin + participant), Recharts 2.13 (dashboards), react-dropzone (uploads), papaparse (CSV bulk invite), xlsx (audit export)
- **Dev mocking:** MSW 2.6 — full UI works against fixtures when `VITE_MOCK_API=true`
- **A11y:** axe-core dev-only audit; semantic Radix primitives

### 2.2 Backend (Django REST API)
- **Framework:** Django 5.0.9 + DRF 3.15.2
- **Settings split:** `config/settings/{base,dev,production,test}.py`
- **Auth:** `rest_framework_simplejwt` — 15 min access, 7 day rotating refresh, blacklist on rotation
- **Throttling:** ⚠️ none configured (open issue)
- **OpenAPI:** drf-spectacular 0.27 → `/api/schema/` + `/api/docs/`
- **Validation:** DRF serializers, custom `validate_password` (set on change but not on invite-set)
- **File upload:** SAS-based direct-to-Blob with 15-min upload/download windows
- **Background jobs:** Celery 5.4 + django-celery-beat 2.7 (DB-backed schedule, mutable from admin)
- **Logging:** Django default + JSON in production (recommended Sentry SDK)
- **Health:** `apps.common.views.HealthzView` returns DB + Redis + scheduler heartbeat

### 2.3 Data layer
- **Primary DB:** PostgreSQL 15 on Azure DB Flexible Server (B2s) — psycopg 3.2
- **Cache + JWT blacklist:** Redis 7 via `django-redis` 5.4 (LRU, no persistence by default)
- **Celery broker:** Redis db1
- **Celery results:** Redis db2
- **Object store:** Azure Blob Storage via `azure-storage-blob` 12.23 + `django-storages` 1.14

### 2.4 Background processing
- `celery -A config worker` (systemd unit `aclp-worker`)
- `celery -A config beat` (systemd unit `aclp-beat`)
- Beat schedule (configured in `config/celery.py`):
  - `heartbeat` — 60 s
  - `open_due_tasks` — 60 s
  - `send_class_start_reminders` — 60 s
  - `send_deadline_reminders` — 60 s
  - `attendance_closing_soon_warning` — dynamic
  - `aggregate_daily` — 02:00 UTC

## 3. Request Lifecycle Flows

### 3.1 Login → authenticated request
```
POST /api/v1/auth/login {email,password}
  └─ LoginView.serializer → User.check_password (Argon2)
     ├─ access JWT (15 min) → body
     └─ refresh JWT (7 d)   → HttpOnly cookie scoped to /api/v1/auth/refresh

GET /api/v1/me   Authorization: Bearer <access>
  └─ JWTAuthentication → request.user
     └─ MeView → UserSerializer → 200
```

### 3.2 401 → refresh → retry (frontend api-client.ts)
```
GET /api/v1/classes → 401 (access expired)
  ├─ axios response interceptor catches
  ├─ if refresh in flight → push request into refreshQueue
  │  else POST /api/v1/auth/refresh (cookie auto-sent)
  │       └─ new access → auth store + flush queue
  └─ original request retried with new bearer
```

### 3.3 Submission upload (direct-to-Blob via SAS)
```
1. POST /api/v1/assignments/{id}/upload-url
     └─ generate_blob_sas(write=True, create=True, ttl=15min, blob=submissions/{task}/{user}/v{n}/<file>)
     └─ returns {upload_url, blob_name, headers}

2. PUT <upload_url> (direct from browser; never transits Gunicorn)

3. POST /api/v1/assignments/{id}/submissions {blob_name, file_size, file_type}
     └─ Submission(version=last+1, status=…) created
     └─ AuditLog row written
     └─ Notification dispatched (if any)
```

### 3.4 Attendance session start (admin)
```
POST /api/v1/admin/attendance/sessions {class_id, scheduled_end_at?}
  ├─ AttendanceSession.objects.create(status=ACTIVE)
  ├─ UniqueConstraint enforces no other ACTIVE row for class
  ├─ Celery .apply_async(eta=scheduled_end_at - 2min) → attendance_closing_soon_warning
  ├─ Bulk-create Notification(type=ATTENDANCE_SESSION_STARTED) for group members
  └─ AuditLog row

Participants poll GET /api/v1/attendance/active-session every 10 s
  └─ returns session if open & participant is in class.group
```

### 3.5 Notification deep-link
```
Bell click → GET /api/v1/notifications?cursor=...
Click row → router.push(link)  // link stored on Notification (e.g. /me/tasks/<uuid>)
           POST /api/v1/notifications/{id}/read
```

## 4. Module Map (backend apps)

| App | Purpose | Models | Key endpoints |
|---|---|---|---|
| `accounts` | Custom user, JWT, invite, password lifecycle | User, PasswordSetupToken | `/auth/*`, `/me`, `/me/password`, `/me/photo` |
| `users` | Admin user management | (uses User) | `/users/`, `/users/bulk-invite`, `/users/{id}/resend-invite` |
| `groups` | Cohorts | ClassGroup, GroupMembership | `/groups/`, `/groups/{id}/participants` |
| `scheduling` | Class CRUD + participant calendar | Class | `/classes/`, `/me/calendar` |
| `attendance` | On-demand sessions | AttendanceSession, AttendanceRecord | `/admin/attendance/*`, `/attendance/active-session`, `/attendance/sessions/{id}/mark` |
| `assignments` | Tasks + submissions + SAS | AssignmentTask, Submission | `/assignments/`, `/me/tasks`, `/me/submissions` |
| `documents` | Library + shared uploads | Document, ParticipantUploadPermission, ParticipantSharedDoc | `/documents/`, `/admin/groups/{id}/upload-permissions/`, `/admin/shared-uploads/*` |
| `notifications` | In-app bell | Notification | `/notifications/*` |
| `analytics` | Dashboards + daily snapshot | DashboardSnapshot | `/dashboard/admin`, `/dashboard/participant` |
| `audit` | Append-only log | AuditLog | `/audit` |
| `common` | Settings, health, permissions | SystemSettings, SchedulerHealth | `/healthz`, `/admin/settings` |

## 5. ERD (textual)

```
User (UUID, email u, role, full_name, is_active, photo_url, ts)
 ├──< PasswordSetupToken (token_hash u, consumed_at)
 ├──<┬─ AuditLog.actor (SET_NULL)
 ├──<│  Notification (CASCADE, dedupe_key u)
 ├──<│  Submission (CASCADE)
 ├──<│  AttendanceRecord (CASCADE)
 ├──<│  GroupMembership (CASCADE)
 ├──<│  ParticipantUploadPermission (CASCADE)
 ├──<│  ParticipantSharedDoc.uploaded_by (CASCADE)
 └──<└─ ClassGroup.created_by, Class.created_by, Document.uploaded_by … (SET_NULL)

ClassGroup (name u, is_archived, ts)
 ├──< GroupMembership (uniq user+group)
 ├──< Class (CASCADE)
 ├──< Document (CASCADE)
 ├──< AssignmentTask (CASCADE)
 ├──< ParticipantSharedDoc (CASCADE)
 └──< ParticipantUploadPermission (uniq user+group)

Class (group FK, title, starts_at, ends_at, status_cached, attendance_open/close_at, allow_late_attendance)
 ├──< AttendanceSession (CASCADE, uniq ACTIVE per class)
 │    └──< AttendanceRecord (uniq session+user)
 ├──< Document.class_obj (SET_NULL)
 └──< AssignmentTask.class_obj (SET_NULL)

AssignmentTask (group FK, class_obj? FK, deadline_at, late_policy, is_open, is_closed, question_file_*)
 └──< Submission (uniq task+user+version)

Document (group FK, class_obj? FK, doc_type, visibility, allowed_user_ids[])
 └──◯ ParticipantSharedDoc.resulting_document (OneToOne, SET_NULL)
```

## 6. Cross-cutting concerns

| Concern | Mechanism |
|---|---|
| **Pagination** | Cursor (`?cursor=`) on Notifications & AuditLog; offset/limit elsewhere |
| **Response envelope** | `{ data, errors, meta? }` consistent shape |
| **Permissions** | DRF `IsAuthenticated` global default + `IsAdmin` class-level for admin-only views; queryset scoping for participants |
| **Audit hooks** | `apps.audit.services.log_action(actor, action, target, metadata)` called explicitly from views (signal-driven coverage gap) |
| **Notifications** | `apps.notifications.services.notify(user, type, title, body, link, payload, dedupe_key)` — idempotent on dedupe_key |
| **SAS generation** | `apps.assignments.storage.generate_*_sas` (and similar in documents) — 15-min TTL, account-key signed |
| **Timezone** | `SystemSettings.timezone`; default UTC; date-fns-tz on frontend |
| **Idempotent dev mocks** | MSW handlers in `src/mocks/` mirror real envelope and IDs |

## 7. Configuration & Environments

| Env | Settings module | Key differences |
|---|---|---|
| dev | `config.settings.dev` | DEBUG=True, eager Celery, SQLite or local Postgres, DEV_LOCAL_STORAGE=True |
| test | `config.settings.test` | SQLite, locmem cache, eager Celery |
| prod | `config.settings.production` | HTTPS, HSTS 1 yr, Secure cookies, Azure Blob enforced, JWT cookie SameSite=Strict |

## 8. Build & Bundle Strategy

- **Frontend:** Vite `tsc -b && vite build` → static `dist/` served by Nginx; SourceMaps off in prod; chunk strategy = Vite defaults
- **Backend:** no compile step; deployed via `git pull` + `pip install -r requirements.txt` + `manage.py migrate` + `collectstatic`

## 9. Observability (current state)

| Signal | Source | Sink |
|---|---|---|
| Application errors | Django logging | stdout → journald; **Sentry DSN recommended** |
| Request access logs | Nginx + Gunicorn | /var/log/ |
| Heartbeat | SchedulerHealth.last_heartbeat_at | `/healthz` polled externally |
| DB metrics | Azure DB Flex monitoring | Azure portal |
| Frontend errors | Console; **no Sentry browser yet** | — |
| Audit | AuditLog table | Admin audit page |

## 10. Known Architectural Debt

1. Single-VM SPOF — no horizontal scaling, no LB
2. Celery broker on same VM as workers — DB-only mode possible at lower scale
3. No CDN for SPA static — Nginx serves directly
4. No CI/CD pipeline visible in repo (GitHub Actions absent)
5. Sentry, OpenTelemetry, structured JSON logs not wired up
6. Audit immutability is Python-level only; bulk SQL bypasses it
7. Forgot-password token persistence gap (see SECURITY_AUDIT.md)
8. Photo MIME type not magic-byte verified

---
*Generated 2026-05-28 from source.*
