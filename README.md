# ACLP Training Management System (TMS)

> Training & Class Assignment Management Portal — React + Django + PostgreSQL on Azure

A web-based platform to manage physical training sessions, class scheduling, attendance tracking, assignment submission, and document sharing across three roles: **Admin**, **Participant**, and **Instructor**.

---

## Table of Contents

- [What's Implemented](#whats-implemented)
- [Roles & Capabilities](#roles--capabilities)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Background Jobs](#background-jobs)
- [Deployment](#deployment)
- [Development Workflow](#development-workflow)

---

## What's Implemented

### Backend — Django REST API (11 apps)

| Module                     | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Authentication**         | JWT login / refresh / logout, invite flow, force-change-password on first login, email case-insensitive |
| **User Management**        | Single-invite and bulk CSV invite, user CRUD (admin-only)                        |
| **Class Groups**           | Group creation, participant membership management, instructor assignment          |
| **Class Scheduling**       | Class CRUD, computed live status, participant calendar endpoint                  |
| **Attendance**             | On-demand sessions (start/end), participant mark, admin override, session report |
| **Assignments**            | Task lifecycle, Azure Blob SAS question upload, auto-open at deadline            |
| **Submissions**            | Participant file upload (SAS), versioning, admin review                          |
| **Documents**              | Library management, 4 visibility modes, SAS download                            |
| **Shared Uploads**         | Participant upload → admin approve/reject → optional library promotion          |
| **Notifications**          | In-app bell, 12 event types, deep-linked to specific pages, mark read / read all, cursor pagination |
| **Analytics**              | Admin & participant dashboards, daily snapshot (Celery), 14-day trend            |
| **Audit Log**              | Immutable append-only log, filterable by actor / action / target                 |
| **System Settings**        | Singleton config: file size limits, reminder offsets, timezone                   |
| **Health Check**           | DB + Redis + scheduler liveness at `/api/v1/healthz`                            |
| **Background Tasks**       | Celery beat: reminders, auto-open tasks, class alerts, daily aggregation         |

### Frontend — React SPA (F-01 → F-13 complete + Instructor role)

| Feature Area                    | Description                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| **Auth Flow**                   | Login, set-password, force-change-password on first login, JWT token auto-refresh |
| **Admin Dashboard**             | KPIs, trend charts (Recharts), group analytics, recent activity       |
| **User Management**             | Invite, bulk CSV import (papaparse), user table with filters          |
| **Group Management**            | CRUD, member add/remove, instructor assignment, per-group analytics   |
| **Class Management**            | CRUD, FullCalendar month/week/list, class detail                      |
| **Attendance Control**          | Admin: start/end session, report. Participant: 10s poll + mark button |
| **Assignment Management**       | Task CRUD, question file upload, publish/close                        |
| **Submission Review**           | Admin review queue, download files                                    |
| **Document Library**            | Upload, 4 visibility levels, filter by document type                  |
| **Shared Uploads**              | Participant drag-and-drop upload, 3-step presigned flow, admin approve/reject queue, status tracking |
| **Participant Dashboard**       | Today's class card, pending tasks, submission stats                   |
| **Instructor Dashboard**        | Teaching schedule, group assignments, attendance management           |
| **Notifications**               | Bell dropdown, notification centre, unread count badge, deep-linked to related pages |
| **Audit Log**                   | Filterable audit trail table with cursor pagination                   |
| **System Settings**             | Admin-editable system configuration page                              |
| **Mock API**                    | MSW (Mock Service Worker) dev mode available; production mode hits real Django backend |

---

## Roles & Capabilities

Three roles exist: **Admin**, **Participant**, and **Instructor**.

### Admin

| Area           | What they can do                                                                      |
| -------------- | ------------------------------------------------------------------------------------- |
| Users          | Invite single or bulk (CSV), manage profiles, resend invite links                     |
| Groups         | Create / edit / archive groups, add or remove participants, assign instructors         |
| Classes        | Create / edit / cancel classes, view full system calendar                             |
| Attendance     | Start / end on-demand sessions, override individual records, download session reports |
| Assignments    | Create tasks with file attachments, set deadlines, publish / close                    |
| Submissions    | View all participant submissions, download files                                      |
| Documents      | Upload, set visibility (Group / Selected / Staff / Public), delete                    |
| Shared Uploads | Grant / revoke participant upload permission per group, approve / reject uploads      |
| Dashboard      | System-wide KPIs, trend charts, group analytics, participant activity                 |
| Audit Log      | Full immutable audit trail, filterable by actor / action / target                     |
| Settings       | Product name, timezone, file-size limits, reminder offsets                            |
| Notifications  | Receive all system events                                                             |

### Participant

| Area           | What they can do                                                         |
| -------------- | ------------------------------------------------------------------------ |
| Dashboard      | Today's class, pending task count, submission statistics                 |
| Calendar       | Personal class schedule (month / week / list)                            |
| Classes        | View class details, see attendance status                                |
| Attendance     | Mark self present when admin opens a session (polls every 10 s)          |
| Tasks          | View assigned tasks, download question files, upload submissions         |
| Submissions    | Track own submission history, download submitted files                   |
| Documents      | View and download documents shared with their group                      |
| Shared Uploads | Upload documents to group (if permission granted), track approval status |
| Profile        | Update name and photo                                                    |
| Notifications  | Receive task, class, attendance, and document events                     |

### Instructor

| Area           | What they can do                                                         |
| -------------- | ------------------------------------------------------------------------ |
| Dashboard      | Assigned groups, upcoming classes, attendance summaries                  |
| Groups         | View groups they are assigned to teach                                   |
| Classes        | View and manage classes for assigned groups                              |
| Attendance     | Start/end attendance sessions for their classes                          |
| Assignments    | Create and manage assignments for their groups                           |
| Submissions    | Review participant submissions for their assignments                     |
| Documents      | Upload and manage documents for their groups                             |
| Notifications  | Receive class, attendance, and assignment events for their groups        |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Client Browser                       │
│          React 18 SPA  (Vite + TS)               │
└─────────────────────┬────────────────────────────┘
                      │  HTTPS  (JWT Bearer)
                      ▼
┌──────────────────────────────────────────────────┐
│             Azure VM  (Ubuntu 22.04)              │
│                                                   │
│  Nginx ──▶ Gunicorn (3 sync workers)             │
│                   Django 5 + DRF                  │
│                                                   │
│  Celery Worker + Celery Beat                      │
│                                                   │
│  PostgreSQL 15 (Azure DB Flexible)                │
│  Redis 7  (JWT blacklist · Celery · Cache)        │
└─────────────────────┬────────────────────────────┘
                      │  SAS token (15 min, scoped)
                      ▼
         Azure Blob Storage
     (questions · submissions · docs)
```

### Key Design Decisions

| Decision             | Choice                                                       | Reason                                              |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Real-time attendance | 10 s polling                                                 | Simple, no WebSocket infra needed at this scale     |
| File uploads         | Direct-to-Blob via SAS                                       | Videos never transit Gunicorn; 15-min scoped tokens |
| Auth tokens          | JWT 15 min access + 7-day rotating refresh (httpOnly cookie) | Stateless API + XSS-safe refresh                    |
| Password hashing     | Argon2 (primary)                                             | Industry-best resistance to GPU cracking            |
| Audit log            | Immutable at model layer (save/delete raise)                 | Compliance requirement                              |
| Celery mode (dev)    | `TASK_ALWAYS_EAGER = True`                                   | No broker/worker needed locally                     |
| Instructor role      | Feature-flagged via `INSTRUCTOR_ROLE_ENABLED`                | Safe rollout without breaking existing flows        |

---

## Tech Stack

### Frontend

| Category      | Package                                                            |
| ------------- | ------------------------------------------------------------------ |
| Framework     | React 18.3 + TypeScript 5.5 + Vite 5.4                            |
| Styling       | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) + Framer Motion 11 |
| Routing       | React Router 6.27                                                  |
| Server state  | TanStack Query 5.59                                                |
| Client state  | Zustand 5                                                          |
| Forms         | React Hook Form 7 + Zod 3.23                                       |
| Calendar      | FullCalendar 6 (daygrid, list, interaction)                        |
| Charts        | Recharts 2.13                                                      |
| File handling | react-dropzone 14 + papaparse 5.4                                  |
| HTTP          | Axios 1.7                                                          |
| Dev mocking   | MSW 2.6 (Mock Service Worker)                                      |
| Testing       | Vitest 1.6 + Testing Library 16                                    |

### Backend

| Category       | Package                                          |
| -------------- | ------------------------------------------------ |
| Framework      | Django 5.0.9 + DRF 3.15.2                        |
| Auth           | django-rest-framework-simplejwt 5.3.1            |
| Database       | PostgreSQL 15 via psycopg 3.2                    |
| Cache / Broker | Redis 7 via django-redis 5.4                     |
| Task queue     | Celery 5.4 + django-celery-beat 2.7              |
| File storage   | azure-storage-blob 12.23 + django-storages 1.14  |
| Schema         | drf-spectacular 0.27 (OpenAPI 3 + Swagger UI)    |
| Password hash  | argon2-cffi 23.1                                 |
| Testing        | pytest 8.3 + pytest-django 4.9 + factory-boy 3.3 |
| Linting        | Ruff 0.7 + mypy 1.13 + django-stubs 5.0          |
| Env vars       | django-environ 0.11                              |
| Filtering      | django-filter 24.3                               |

### Infrastructure

| Component    | Technology                                        |
| ------------ | ------------------------------------------------- |
| VM           | Azure Standard_D2s_v3 · Ubuntu 22.04             |
| Database     | Azure Database for PostgreSQL Flexible Server B2s |
| Storage      | Azure Blob Storage                                |
| Web server   | Nginx (reverse proxy + static)                    |
| App server   | Gunicorn 3 sync workers                           |
| Process mgmt | systemd (Django · Celery worker · Celery beat)    |
| SSL          | Let's Encrypt via certbot                         |

---

## Project Structure

```
Employee Managment/
├── frontend/                        # React TypeScript SPA
│   ├── src/
│   │   ├── api/                     # Axios API modules per domain
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── groups.ts
│   │   │   ├── classes.ts
│   │   │   ├── attendance.ts
│   │   │   ├── assignments.ts
│   │   │   ├── submissions.ts
│   │   │   ├── documents.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── notifications.ts
│   │   │   ├── audit.ts
│   │   │   └── settings.ts
│   │   ├── components/
│   │   │   ├── layout/              # AppShell, navbars, sidebars
│   │   │   ├── motion/              # Framer Motion wrappers
│   │   │   ├── states/              # Loading / empty / error state components
│   │   │   └── ui/                  # shadcn/ui component library
│   │   ├── features/
│   │   │   ├── admin/               # Admin-only feature components
│   │   │   ├── participant/         # Participant-only feature components
│   │   │   ├── instructor/          # Instructor-only feature components
│   │   │   ├── auth/                # Auth forms and guards
│   │   │   ├── charts/              # Recharts wrappers
│   │   │   ├── group-detail/        # Group detail components
│   │   │   └── notifications/       # Notification bell + list
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/
│   │   │   ├── api-client.ts        # Axios instance + JWT interceptors
│   │   │   └── types.ts             # Shared TypeScript types
│   │   ├── mocks/                   # MSW handlers + seed data
│   │   ├── pages/
│   │   │   ├── admin/               # All /admin/* route pages
│   │   │   ├── auth/                # Login, SetPassword, ForgotPassword
│   │   │   ├── instructor/          # All /instructor/* route pages
│   │   │   └── participant/         # All /me/* route pages
│   │   ├── router/                  # React Router config + RoleGuard
│   │   ├── store/                   # Zustand: auth.ts, settings.ts
│   │   └── styles/                  # Global CSS (gradients, overrides)
│   ├── public/                      # Static assets + MSW service worker
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                         # Django REST API
│   ├── apps/
│   │   ├── accounts/                # Custom User, JWT auth, invite flow
│   │   ├── analytics/               # Dashboard aggregations + daily snapshots
│   │   ├── assignments/             # Tasks, submissions, Azure Blob SAS
│   │   ├── attendance/              # Sessions, records, override, report
│   │   ├── audit/                   # Immutable append-only AuditLog
│   │   ├── common/                  # Base models, permissions, health, seed
│   │   ├── documents/               # Document library + shared-upload approval
│   │   ├── groups/                  # ClassGroup + GroupMembership
│   │   ├── notifications/           # In-app Notification bell endpoints
│   │   ├── scheduling/              # Class CRUD + /me/calendar
│   │   └── users/                   # Admin user management ViewSet
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py              # Shared settings (JWT, CORS, Celery, ...)
│   │   │   ├── dev.py               # Debug on, eager Celery, local storage
│   │   │   ├── production.py        # HTTPS, HSTS, Secure cookies
│   │   │   └── test.py              # SQLite, locmem cache, eager Celery
│   │   ├── celery.py                # Celery app + beat schedule
│   │   ├── urls.py                  # Root URL dispatcher
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── .env.example
│   ├── docker-compose.dev.yml       # PostgreSQL 16 + Redis 7 for local dev
│   ├── requirements.txt
│   ├── manage.py
│   └── pyproject.toml               # Ruff + mypy configuration
│
├── Deployment 1.0/                  # Full deployment documentation
├── docs/                            # Feature documentation
├── plan/                            # Architecture, API design, requirements
└── README.md                        # This file
```

---

## Quick Start

### Prerequisites

- Node.js 20+ and npm 10+
- Python 3.11+
- Docker (for local PostgreSQL + Redis)

### Clone

```bash
git clone https://github.com/Rutvik5o/EMS.git
cd "Employee Managment"
```

---

### Backend

```powershell
cd backend

# 1. Start PostgreSQL + Redis
docker compose -f docker-compose.dev.yml up -d

# 2. Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
# source .venv/bin/activate           # Linux/macOS

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
Copy-Item .env.example .env
# Edit .env — set SECRET_KEY (any random string works for dev)

# 5. Migrate database
python manage.py migrate

# 6. Import real participant data (1129 participants, 25 batches, 55 instructors, 27 group admins)
python manage.py import_detu --xlsx path/to/detu.xlsx

# 7. Start development server
python manage.py runserver
```

- API: `http://localhost:8000/api/v1/`
- Swagger UI: `http://localhost:8000/api/docs/`

**Current credentials** (live data from `import_detu`):

| Role         | Email                        | Password    | Notes                          |
| ------------ | ---------------------------- | ----------- | ------------------------------ |
| Super Admin  | super.admin@adani.com        | password123 | Only admin account             |
| Instructor   | divyansh.jha@adani.com       | admin123    | Example — 55 instructors total |
| Instructor   | vineet.jain1@adani.com       | admin123    | Batches assigned               |
| Group Admin  | (any group admin account)    | admin123    | 27 group admins total          |
| Participant  | aagam.dosaliya@adani.com     | admin123    | Example — 1129 total           |
| Participant  | (any adani.com participant)  | admin123    | All 1129 from detu.xlsx        |

**Data summary:** 1 Super Admin · 55 Instructors · 27 Group Admins · 1129 Participants across 25 Batches (Batch-1 to Batch-25)

> All accounts except Super Admin have `must_change_password = True` — a non-dismissible dialog prompts users to set a new password on first login.

---

### Frontend

```powershell
cd frontend

# 1. Install dependencies
npm ci

# 2. Configure environment
Copy-Item .env.example .env
# VITE_MOCK_API=true   → full UI with MSW mocks (no backend needed)
# VITE_MOCK_API=false  → connect to backend at localhost:8000

# 3. Start dev server
npm run dev
```

App runs at `http://localhost:5173`.

**Mock mode** (`VITE_MOCK_API=true`): The full UI works without the backend using MSW interceptors and seed data. Useful for isolated frontend development.

---

### Running Tests

```powershell
# Backend (422+ tests)
cd backend
pytest

# Frontend type-check + lint
cd frontend
npm run typecheck
npm run lint

# Frontend unit tests
npm run test

# Frontend production build
npm run build
```

---

### Running Celery (optional for local dev)

In dev mode, Celery tasks run synchronously inline (`TASK_ALWAYS_EAGER = True`). For true async testing:

```powershell
# Worker
celery -A config worker -l info --pool=solo

# Beat scheduler (separate terminal)
celery -A config beat -l info
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable                   | Dev default                                            | Description                         |
| -------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `SECRET_KEY`               | *(required)*                                           | Django secret key                   |
| `DEBUG`                    | `True`                                                 | Enable debug mode                   |
| `DATABASE_URL`             | `postgres://ems_user:ems_pass@localhost:5432/ems_db`   | PostgreSQL connection               |
| `REDIS_URL`                | `redis://localhost:6379/0`                             | Redis for cache + Celery            |
| `ALLOWED_HOSTS`            | `localhost,127.0.0.1`                                  | Comma-separated allowed hosts       |
| `CORS_ALLOWED_ORIGINS`     | `http://localhost:5173`                                | Allowed frontend origins            |
| `FRONTEND_URL`             | `http://localhost:5173`                                | Used in invite/reset email links    |
| `EMAIL_BACKEND`            | `console` backend                                      | Django email backend class          |
| `EMAIL_HOST`               | *(empty)*                                              | SMTP host                           |
| `EMAIL_PORT`               | `587`                                                  | SMTP port                           |
| `EMAIL_HOST_USER`          | *(empty)*                                              | SMTP username                       |
| `EMAIL_HOST_PASSWORD`      | *(empty)*                                              | SMTP password                       |
| `EMAIL_USE_TLS`            | `True`                                                 | Enable TLS for SMTP                 |
| `DEFAULT_FROM_EMAIL`       | `Employee Management System <noreply@ems.local>`       | Sender email address                |
| `AZURE_ACCOUNT_NAME`       | *(empty)*                                              | Azure Storage account name          |
| `AZURE_ACCOUNT_KEY`        | *(empty)*                                              | Azure Storage key                   |
| `AZURE_CONTAINER`          | *(empty)*                                              | Blob container name                 |
| `DEV_LOCAL_STORAGE`        | `True`                                                 | Use local upload/download endpoints |
| `CELERY_BROKER_URL`        | `redis://localhost:6379/0`                             | Celery message broker               |
| `CELERY_RESULT_BACKEND`    | `redis://localhost:6379/1`                             | Celery result store                 |
| `CELERY_TASK_ALWAYS_EAGER` | `False`                                                | Run tasks synchronously in dev      |
| `INSTRUCTOR_ROLE_ENABLED`  | `True` (dev) / `False` (base)                          | Feature flag for instructor role    |

### Frontend (`frontend/.env`)

| Variable              | Default                          | Description          |
| --------------------- | -------------------------------- | -------------------- |
| `VITE_API_BASE_URL`   | `http://localhost:8000/api/v1`   | Backend API base URL |
| `VITE_APP_NAME`       | `Employee Management System`     | App display name     |
| `VITE_MOCK_API`       | `true`                           | Enable MSW mock mode |

---

## API Reference

Full OpenAPI 3 schema: `GET /api/v1/schema/` (YAML)  
Interactive Swagger UI: `http://localhost:8000/api/docs/`

### Endpoint Groups

| Group                       | Base Path                                         | Auth        |
| --------------------------- | ------------------------------------------------- | ----------- |
| Auth                        | `/api/v1/auth/`                                   | Public      |
| Profile                     | `/api/v1/me`                                      | JWT         |
| Change password             | `/api/v1/me/password`                             | JWT         |
| Users (admin)               | `/api/v1/users/`                                  | JWT + Admin |
| Groups                      | `/api/v1/groups/`                                 | JWT         |
| Classes                     | `/api/v1/classes/`                                | JWT         |
| Participant calendar        | `/api/v1/me/calendar`                             | JWT         |
| Attendance sessions (admin) | `/api/v1/admin/attendance/sessions/`              | JWT + Admin |
| Attendance override (admin) | `/api/v1/admin/attendance/records/`               | JWT + Admin |
| Attendance (participant)    | `/api/v1/attendance/active-session`               | JWT         |
| Assignments                 | `/api/v1/assignments/`                            | JWT         |
| Participant tasks           | `/api/v1/me/tasks`                                | JWT         |
| Submissions                 | `/api/v1/me/submissions`                          | JWT         |
| Documents                   | `/api/v1/documents/`                              | JWT         |
| Upload permissions (admin)  | `/api/v1/admin/groups/{id}/upload-permissions/`   | JWT + Admin |
| Participant upload perms    | `/api/v1/me/upload-permissions`                   | JWT         |
| My shared uploads           | `/api/v1/me/shared-uploads`                       | JWT         |
| Participant upload URL      | `/api/v1/groups/{id}/shared-upload-url`           | JWT         |
| Shared uploads              | `/api/v1/groups/{id}/shared-uploads`              | JWT         |
| Shared uploads (admin)      | `/api/v1/admin/shared-uploads/`                   | JWT + Admin |
| Notifications               | `/api/v1/notifications/`                          | JWT         |
| Dashboard (admin)           | `/api/v1/dashboard/admin`                         | JWT + Admin |
| Dashboard (participant)     | `/api/v1/dashboard/participant`                   | JWT         |
| Dashboard (manager)         | `/api/v1/dashboard/manager`                       | JWT         |
| Audit log                   | `/api/v1/audit`                                   | JWT + Admin |
| Settings                    | `/api/v1/admin/settings`                          | JWT + Admin |
| Health                      | `/api/v1/healthz`                                 | Public      |

### Response Envelope

All responses use a consistent envelope:

```json
{
  "data": { "..." },
  "errors": []
}
```

Paginated responses include a `meta` block:

```json
{
  "data": [],
  "meta": {
    "next_cursor": "2026-05-25T10:00:00Z",
    "previous_cursor": null
  }
}
```

---

## Background Jobs

Celery beat runs all scheduled tasks. In dev mode they execute synchronously.

| Task                                | Schedule              | Description                                                              |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `heartbeat`                         | Every 60 s            | Update scheduler liveness timestamp                                      |
| `open_due_tasks`                    | Every 60 s            | Auto-open tasks at `upload_open_at`, notify `TASK_OPENED`               |
| `send_class_start_reminders`        | Every 60 s            | Send `CLASS_STARTING_SOON` 4–6 min before class start                   |
| `send_deadline_reminders`           | Every 60 s            | Send `DEADLINE_REMINDER` at configured reminder offsets                  |
| `attendance_closing_soon_warning`   | Every 60 s            | Fire 2 min before a timed session ends; notify only unmarked participants |
| `aggregate_daily`                   | 2:00 AM UTC           | Snapshot dashboard metrics for the day                                   |

### Notification Types

| Type                           | Triggered by                                                    | Deep link                  |
| ------------------------------ | --------------------------------------------------------------- | -------------------------- |
| `TASK_OPENED`                  | Task auto-opens at `upload_open_at`                             | `/me/tasks/{id}`           |
| `DEADLINE_REMINDER`            | Configurable offsets before task deadline                       | `/me/tasks/{id}`           |
| `CLASS_SCHEDULED`              | Admin creates a class                                           | `/me/classes/{id}`         |
| `CLASS_STARTING_SOON`          | 4–6 min before class start (Celery beat)                       | `/me/classes/{id}`         |
| `CLASS_RESCHEDULED`            | Admin changes `starts_at` or `ends_at` on an existing class    | `/me/classes/{id}`         |
| `CLASS_DOCUMENT_ADDED`         | Admin uploads a doc linked to a class                           | `/me/classes/{id}`         |
| `CLASS_TASK_ASSIGNED`          | Admin allocates a locked assignment to a class                  | `/me/classes/{id}`         |
| `ATTENDANCE_SESSION_STARTED`   | Admin starts an attendance session                              | `/me/classes/{id}`         |
| `ATTENDANCE_SESSION_ENDED`     | Admin ends an attendance session                                | `/me/classes/{id}`         |
| `ATTENDANCE_CLOSING_SOON`      | 2 min before a timed session ends (only unmarked)              | `/me/classes/{id}`         |
| `SHARED_DOC_RESULT`            | Admin approves or rejects a participant upload                  | `/me/documents`            |
| `GROUP_ADDED`                  | Participant is added to a group                                 | —                          |

---

## Deployment

Target: **Azure VM** (Standard_D2s_v3, Ubuntu 22.04) + **Azure Database for PostgreSQL Flexible Server** (B2s) + **Azure Blob Storage**

See `Deployment 1.0/DEPLOYMENT_GUIDE.md` for the complete step-by-step production deployment guide.

### Process layout on the VM

```
Nginx (port 443/80)
  └── Gunicorn (unix socket, 3 sync workers)
         └── Django (production settings)

Celery Worker (systemd unit: ems-worker)
Celery Beat   (systemd unit: ems-beat)

PostgreSQL 15 — Azure DB Flexible Server
Redis 7       — VM-local via Docker
```

### Production checklist

- [ ] Set `DEBUG=False` and `SECRET_KEY` in `/etc/app/env` (mode 0640)
- [ ] Use `DJANGO_SETTINGS_MODULE=config.settings.production`
- [ ] Configure Nginx with two server blocks (HTTP redirect + HTTPS)
- [ ] Obtain SSL certificate: `certbot --nginx -d <domain>`
- [ ] Set `AZURE_ACCOUNT_NAME`, `AZURE_ACCOUNT_KEY`, `AZURE_CONTAINER`
- [ ] Set `EMAIL_HOST*` for transactional email (SMTP / Microsoft 365)
- [ ] Enable `SECURE_SSL_REDIRECT`, `HSTS_SECONDS=31536000`
- [ ] Create systemd units for Gunicorn, Celery worker, Celery beat
- [ ] Set up daily PostgreSQL backups (Azure PITR enabled by default on Flex Server)
- [ ] Configure Sentry DSN for error tracking (optional)

---

## Development Workflow

Trunk-based development with short-lived feature branches.

```
main                       # production-ready at all times
├── feat/feature-name      # new features
├── fix/bug-name           # bug fixes
└── chore/task-name        # tooling, deps, config
```

**Rules:**

- Squash-merge to `main` — no force-push to `main`
- Friday releases: tag `v0.x.0` on main; hotfixes: `v0.x.1`

**Commit format:** `type(scope): description`

- Types: `feat` · `fix` · `chore` · `refactor` · `test` · `docs`

**Before opening a PR:**

```powershell
# Frontend
npm run typecheck && npm run lint && npm run build

# Backend
pytest && ruff check . && mypy .
```

---

## Repository

GitHub: https://github.com/Rutvik5o/EMS.git
