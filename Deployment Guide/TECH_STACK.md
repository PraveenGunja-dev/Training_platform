# ACLP Training Management System — Technology Stack (Deployment Reference)

This document describes the technology stack from a deployment/operations perspective. For developer-focused details, see the root-level `TECH_STACK.md`.

---

## Runtime Technology Stack

### Backend Runtime

| Technology       | Version  | Deployment Role                                          |
| ---------------- | -------- | -------------------------------------------------------- |
| Python           | 3.11     | Backend application runtime                              |
| Django           | 5.0.9    | Web framework + ORM + admin panel                        |
| Django REST Framework | 3.15.2 | REST API layer                                      |
| Gunicorn         | Latest   | WSGI production server (3 sync workers)                  |
| Celery           | 5.4.0    | Background task worker                                   |
| django-celery-beat | 2.7.0  | Scheduled task management (stored in PostgreSQL)         |

### Frontend Runtime

| Technology  | Version | Deployment Role                                          |
| ----------- | ------- | -------------------------------------------------------- |
| React       | 18.3.1  | Frontend SPA (compiled to static HTML/JS/CSS)            |
| Vite        | 5.4.10  | Build tool — outputs to `frontend/dist/`                 |
| TypeScript  | 5.5.4   | Compiled away — no runtime TypeScript                    |

> The frontend is a **static build** after `npm run build`. No Node.js runtime is needed on the server — only Nginx serves the static files.

---

## Infrastructure Stack

### Server

| Component    | Specification                                      | Purpose                      |
| ------------ | -------------------------------------------------- | ---------------------------- |
| Azure VM     | Standard_D2s_v3 (2 vCPUs, 8 GB RAM)               | Application server           |
| OS           | Ubuntu 22.04 LTS                                   | Operating system             |
| Nginx        | 1.18+ (via apt)                                    | Reverse proxy + static files |

### Database

| Component    | Specification                                      | Purpose                      |
| ------------ | -------------------------------------------------- | ---------------------------- |
| PostgreSQL   | Version 15                                         | Primary relational database  |
| Hosting      | Azure Database for PostgreSQL Flexible Server B2s  | Managed DB (no maintenance)  |
| Adapter      | psycopg 3.2.3 (binary)                             | Python PostgreSQL driver     |

### Cache & Message Broker

| Component    | Specification                                      | Purpose                                      |
| ------------ | -------------------------------------------------- | -------------------------------------------- |
| Redis        | 7 (Docker: `redis:7-alpine`)                       | JWT blacklist, Celery broker, Django cache   |
| Deployment   | Docker container, bound to `127.0.0.1:6379`        | Local to VM, not exposed publicly            |

### File Storage

| Component    | Specification                                      | Purpose                              |
| ------------ | -------------------------------------------------- | ------------------------------------ |
| Azure Blob   | Standard LRS (upgrade to GRS for production)       | Assignment files, submissions, docs  |
| Access method| SAS tokens (15-min, scoped)                        | Direct browser ↔ Blob upload/download |
| SDK          | azure-storage-blob 12.23.1                         | Token generation in Django           |

### Process Management

| Service        | Manager  | Unit name           | What it runs                            |
| -------------- | -------- | ------------------- | --------------------------------------- |
| Web server     | systemd  | `aclp-gunicorn`     | `gunicorn config.wsgi:application`      |
| Background jobs| systemd  | `aclp-worker`       | `celery -A config worker`               |
| Task scheduler | systemd  | `aclp-beat`         | `celery -A config beat`                 |
| Redis          | Docker   | `redis` container   | `redis:7-alpine` with `--restart=always`|

### SSL/TLS

| Component    | Tool                          | Details                            |
| ------------ | ----------------------------- | ---------------------------------- |
| Certificate  | Let's Encrypt                 | Free, auto-renewable               |
| Automation   | Certbot with Nginx plugin     | Auto-renewal via systemd timer     |

---

## Software Versions Quick Reference

### Backend Python Packages (pinned in `backend/requirements.txt`)

```
Django==5.0.9
djangorestframework==3.15.2
djangorestframework-simplejwt==5.3.1
psycopg[binary]==3.2.3
django-environ==0.11.2
django-cors-headers==4.5.0
argon2-cffi==23.1.0
drf-spectacular==0.27.2
django-redis==5.4.0
azure-storage-blob==12.23.1
django-storages[azure]==1.14.4
django-filter==24.3
celery==5.4.0
django-celery-beat==2.7.0
redis==5.1.1
```

### System Package Requirements (Ubuntu 22.04)

```
nginx
python3.11
python3.11-venv
python3-pip
build-essential
libpq-dev
ca-certificates
curl
ufw
fail2ban
docker.io (or Docker CE)
nodejs (20.x via NodeSource)
certbot
python3-certbot-nginx
```

---

## Port Reference

| Port   | Protocol | Service           | Bound to        | External? |
| ------ | -------- | ----------------- | --------------- | --------- |
| 80     | TCP      | Nginx (HTTP)      | 0.0.0.0         | Yes (redirect to HTTPS) |
| 443    | TCP      | Nginx (HTTPS)     | 0.0.0.0         | Yes       |
| 6379   | TCP      | Redis             | 127.0.0.1       | No        |
| 5432   | TCP      | PostgreSQL        | Azure Flex (remote) | No (private endpoint) |
| socket | Unix     | Gunicorn          | /run/aclp.sock  | No        |

---

## Authentication & Security Stack

| Layer                  | Technology                              |
| ---------------------- | --------------------------------------- |
| Transport security     | TLS 1.2/1.3 via Nginx + Let's Encrypt  |
| Application auth       | JWT (HS256) via djangorestframework-simplejwt |
| Access token           | 15-minute lifetime, Bearer header       |
| Refresh token          | 7-day lifetime, HttpOnly cookie (Strict SameSite in prod) |
| Token blacklist        | Redis (JWT blacklist app)               |
| Password hashing       | Argon2 (primary), PBKDF2 (fallback)    |
| Rate limiting          | Nginx `limit_req` on /auth/login; DRF throttling on /auth/refresh (30/min) and /me/password (20/hour) |
| CORS                   | django-cors-headers, credentials allowed|
| Security headers       | Nginx (HSTS, X-Frame-Options, CSP, etc.)|
| CSRF                   | Django CSRF middleware (Strict in prod) |

---

## Celery Task Schedule

| Task                          | Schedule      | What it does                                        |
| ----------------------------- | ------------- | --------------------------------------------------- |
| `heartbeat`                   | Every 60s     | Updates `SchedulerHealth` — monitors Celery is alive|
| `open_due_tasks`              | Every 60s     | Auto-opens assignments when `upload_open_at` passes |
| `send_deadline_reminders`     | Every 60s     | Sends `DEADLINE_REMINDER` notifications             |
| `send_class_start_reminders`  | Every 60s     | Sends `CLASS_STARTING_SOON` 4–6 min before class   |
| `send_attendance_session_reminders`| Every 60s| Sends `ATTENDANCE_CLOSING_SOON` 2 min before end   |
| `aggregate_daily`             | 2:00 AM UTC   | Computes daily dashboard snapshot                   |

Note: The late-attendance QR window (5 min after class ends) is time-checked on demand — no Celery task needed.

---

## Django Application Modules

| App Module           | What it manages                                          |
| -------------------- | -------------------------------------------------------- |
| `apps.accounts`      | Users, JWT auth, invite flow, force-change-password on first login |
| `apps.groups`        | Class groups, memberships, instructor assignments        |
| `apps.scheduling`    | Classes, calendar, live status computation               |
| `apps.attendance`    | Attendance sessions, records, overrides, reports         |
| `apps.assignments`   | Tasks, Azure Blob SAS question uploads                   |
| `apps.documents`     | Document library, shared uploads, approval workflow      |
| `apps.notifications` | In-app notifications, 12 event types, preferences        |
| `apps.analytics`     | Dashboard aggregations, daily snapshots                  |
| `apps.audit`         | Immutable append-only audit log                          |
| `apps.users`         | Admin user management ViewSet (CRUD, invite, bulk)       |
| `apps.common`        | Shared models, health check, seed commands, settings     |

---

## New Features in This Release

| Feature | Backend | Frontend |
| ------- | ------- | -------- |
| Force change password on first login | `must_change_password` field on User model | `ForceChangePasswordDialog` (non-dismissible) |
| Email case-insensitive login | Lowercased at serializer + service layer | Lowercased in `useLogin` hook |
| Late attendance QR sharing | `GET /classes/{pk}/participants`, `POST /classes/{pk}/share-qr` | `QRDialog` on ClassesPage, `/me/qr/:classId` page |
| Meeting link on classes | `meeting_link` URLField on ClassSession | Join button on class detail pages |
| User profile fields | `business_unit`, `grade_code`, `department`, `employee_code` on User | Profile Details card on UserDetailPage |
| Server-side user pagination | `EnvelopePageNumberPagination` (page_size=20) + `/users/stats` endpoint | UsersPage uses paginated API |
| Business unit filter | `/users/business-units` endpoint + `UserFilter` | Dropdown filter on UsersPage |
| Role label "Super Admin" | No backend change (`ADMIN` value unchanged) | All UI references to "Admin" → "Super Admin" |
| Change email | `POST /me/email` (`ChangeEmailView`) | `EmailChangeCard` on SettingsPage |
| Delete group | `DELETE /groups/{id}` (existing ViewSet) | Delete button + confirm dialog in GroupHeader |
| Bulk participant import | `python manage.py import_detu` | — |
| Clear demo data | `python manage.py clear_demo_data` | — |
