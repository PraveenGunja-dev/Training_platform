# Business Requirements Document (BRD)

**Project:** ACLP Training Management System — Training & Class Assignment Management Portal
**Owner:** Rutvik Prajapati
**Stakeholder org:** Adani (internal training)
**Revision:** v1.0 — 2026-05-28
**Status:** Active development, F-01 → F-13 + B-01 → B-14 complete, in pre-production hardening

---

## 1. Executive Summary

The ACLP Training Management System is a web-based portal that digitises the end-to-end lifecycle of **in-person and hybrid ACLP training sessions** at Adani. It replaces ad-hoc tooling (Excel rosters, email attachments, WhatsApp reminders) with a single system that manages cohorts, schedules classes, tracks attendance, distributes documents, assigns and grades practical tasks, and audits every action. The platform is delivered as a React Single Page Application against a Django REST API, hosted on Microsoft Azure.

The product targets two roles only: **Admin** (training operators / L&D team) and **Participant** (trainees). A previously planned Manager role was deliberately removed; all management duties consolidate to Admin to reduce permission ambiguity (see ROLE_PERMISSION_MATRIX.md §6).

## 2. Business Drivers

| # | Driver | Pain today | EMS resolution |
|---|---|---|---|
| 1 | Attendance integrity | Paper sign-ins lost / falsified | On-demand digital sessions; participants self-mark within a 10-second polling window; admin override is fully audit-logged |
| 2 | Document distribution | Files dispersed across email, WhatsApp, drives | Central library with four-tier visibility (Group / Selected / Staff-only / Public-to-class) |
| 3 | Assignment turnaround | Submissions arrive on personal email; no version control | Upload-to-Blob via short-lived SAS, automatic versioning, deadline policies (Strict / Late-allowed / Admin-only) |
| 4 | Communication overhead | Manual reminders for every class / deadline | Celery-driven push: class-starting-soon, deadline-reminder, attendance-closing-soon, task-opened (12 event types) |
| 5 | Compliance evidence | No defensible record of who changed what | Append-only audit log enforced at ORM layer with actor / action / target / metadata |
| 6 | Reporting | No real-time view of cohort health | Admin dashboard: KPIs, 14-day trend, per-group analytics, participant-activity feed; daily snapshot cached at 2 AM UTC |

## 3. Scope (In)

### 3.1 Functional scope
- **Identity** — single & bulk-CSV user invite (papaparse), 48-hour invite tokens, JWT login, forgot-password flow, profile photo
- **Cohort management** — ClassGroups with membership add/remove, per-group analytics, archive flag
- **Scheduling** — Class CRUD with computed status (UPCOMING / ONGOING / COMPLETED / CANCELLED), participant calendar (`/me/calendar`), admin FullCalendar with day/week/list views
- **Attendance** — on-demand session start/end, participant self-mark, admin override per record, downloadable session report, configurable lifetime (`session_lifetime_hours`)
- **Assignments** — task CRUD, question file via SAS, auto-open at `upload_open_at`, 3 late-policy modes, configurable reminder offsets, deadline-reminder notifications, admin-only force close
- **Submissions** — direct-to-Blob upload, versioning (unique `task,user,version`), status enum (SUBMITTED / LATE_SUBMITTED / OVERRIDE_BY_ADMIN), admin review queue
- **Documents** — library with 4 visibility modes, class-linkage (sends `CLASS_DOCUMENT_ADDED` push), SAS download
- **Shared uploads** — participant uploads moderated by admin (PENDING / APPROVED / REJECTED), optional promotion to library
- **Notifications** — in-app bell, unread badge, cursor-paginated inbox, mark-one / mark-all read, deep-linked to source entity, dedupe_key prevents duplicates
- **Audit log** — immutable, cursor-paginated, filterable by actor / action / target type
- **Settings** — SystemSettings singleton: product name, timezone, brand colour, file-size caps (doc/image/video MB), reminder offsets, session lifetime
- **Health** — `/api/v1/healthz` checks DB, Redis, scheduler heartbeat

### 3.2 Non-functional scope
- **Performance** — page TTI ≤ 2 s on broadband; list endpoints paginated; dashboard payload pre-aggregated nightly
- **Availability** — single-VM target with manual restart playbook (no HA in MVP)
- **Security** — JWT (15 min access / 7 day rotating refresh), Argon2 password hashing, HSTS, HttpOnly refresh cookie, append-only audit log, SAS-scoped uploads
- **Accessibility** — axe-core dev-only checks; semantic Radix primitives
- **Browsers** — evergreen Chrome / Edge / Firefox / Safari
- **i18n** — English-only product copy (durable preference, no Hindi/Hinglish)
- **Mobile** — responsive web, no native app

## 4. Out of Scope (MVP)

| # | Excluded | Rationale / Future |
|---|---|---|
| 1 | Video conferencing | EMS schedules in-person sessions; integration with Teams/Zoom is future |
| 2 | Live attendance via geofence/biometrics | Polling-based self-mark is acceptable for current scale |
| 3 | Auto-grading of submissions | Admin reviews manually; ML grading deferred |
| 4 | Multi-tenant org isolation | Single tenant (Adani) for MVP |
| 5 | Real-time messaging / chat | Notifications are one-way push |
| 6 | Native mobile apps | Web responsive only |
| 7 | SCIM / SAML SSO | Local accounts + JWT; SSO is future |
| 8 | Public certifications / badges | Out of training operator scope |

## 5. Stakeholders & Users

| Stakeholder | Interest | Frequency of use |
|---|---|---|
| L&D / Training Admin | Schedule classes, review submissions, generate reports | Daily |
| Participant (trainee) | Attend classes, submit work, download materials | Daily during cohort |
| Compliance | Verify audit trail, attendance records | Quarterly |
| IT Ops | Maintain Azure VM, Postgres, Redis, Celery | Weekly |
| Internship reviewer | Evaluate product completeness | One-shot |

## 6. Business Rules

1. **One active attendance session per class.** Enforced by `UniqueConstraint(class_obj WHERE status=ACTIVE)`.
2. **Attendance sessions have a configurable lifetime.** Default 24 hours via `SystemSettings.session_lifetime_hours`.
3. **Assignment versioning** — each `(task, user, version)` is unique; resubmission creates a new version row.
4. **Late submissions** governed by `late_policy`: STRICT blocks, LATE_ALLOWED marks as `LATE_SUBMITTED`, ADMIN_ONLY accepts submissions only when an admin uploads on a participant's behalf.
5. **Audit log is append-only at the ORM layer** — Python-level `save()` / `delete()` raise (see SECURITY_AUDIT.md — bulk SQL bypasses this).
6. **Notification dedupe** — `dedupe_key` is unique; the same `(user, type, target)` cannot fire twice.
7. **Shared-upload promotion** — when admin approves a participant upload, an optional `Document` row is created and linked via `resulting_document` OneToOne.
8. **Role transitions** — legacy MANAGER role data is auto-coerced to ADMIN at frontend rehydration time.
9. **Document visibility** — GROUP (all in group), SELECTED (allowed_user_ids list), STAFF_ONLY (admins), PUBLIC_TO_CLASS (anyone with a class assignment record).
10. **Invite tokens expire at 48 hours** and are single-use (`consumed_at`).

## 7. Acceptance Criteria (MVP gate)

| Module | Acceptance |
|---|---|
| Auth | Login + refresh + invite + change-password all work end-to-end; refresh cookie HttpOnly + Secure in prod |
| Users | Single + CSV bulk invite; resend invite; user table search/filter; 219 backend tests pass |
| Groups | CRUD + member add/remove + analytics tab; archived groups hidden from selectors |
| Scheduling | Admin Calendar shows month/week/list; `/me/calendar` paginated by month |
| Attendance | Start/end session, participant 10-second poll detects open session, mark button enabled only within window, admin override emits audit row |
| Assignments | Auto-open at deadline via Celery beat, deadline reminders fire at configured offsets |
| Documents | All 4 visibility modes round-trip via SAS upload + download |
| Shared uploads | Approve/reject flow updates participant via `SHARED_DOC_RESULT` notification |
| Notifications | Deep-link click navigates to source entity; unread badge accurate |
| Audit | Append-only, cursor pagination, filter by actor/action/target type |
| Dashboard | Admin + participant payloads return without 500s; 14-day trend rendered |
| Settings | Singleton update reflected in next file-upload validation |

## 8. Key Success Metrics (post-launch)

- ≥ 90% attendance digitised within first cohort
- 0 lost submissions per cohort (versioning guarantees)
- Median 4 minutes from "task created" to "all participants notified"
- ≥ 95% notifications delivered in-app within 60 s of trigger
- 0 unauthorised audit-log writes (manual quarterly review)
- p95 dashboard load < 800 ms (snapshot served from cache row)

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Single-VM outage | Medium | High | Azure VM PITR + DB Flex Server PITR; manual restart runbook; horizontal scaling deferred |
| SECRET_KEY compromise = JWT + invite forgery | Low | Critical | Strict env handling (`/etc/app/env` mode 0640); rotation procedure documented |
| Azure Storage account key in env | Low | Critical | Future migration to user-delegation SAS via Managed Identity |
| Brute-force on login/forgot-password | Medium | High | **Currently no rate limiting** — plan: nginx limit_req + django-ratelimit (open) |
| Audit log bypass via bulk SQL | Low | High | DB-level trigger + tamper-evident hash chain (open) |
| Forgot-password flow has gap (token not persisted) | Medium | High | Open issue (see SECURITY_AUDIT.md #1); fix in next sprint |
| Mock API drift vs real backend | Medium | Medium | MSW seed re-validated in CI against OpenAPI schema |
| Celery beat downtime → silent missed reminders | Medium | Medium | `/healthz` checks `SchedulerHealth.last_heartbeat_at`; Sentry alert on lag > 5 min |

## 10. Dependencies & Assumptions

- Azure subscription with Blob Storage + DB Flex Server provisioned
- SMTP relay (Microsoft 365 / SendGrid) for invite + reset emails
- Domain + Let's Encrypt SSL
- Sentry DSN for prod error capture (recommended, not blocking)
- All users have email accounts and modern browsers
- Single timezone per deployment (configurable per `SystemSettings.timezone`)

## 11. Timeline & Phases

| Phase | Scope | Status |
|---|---|---|
| ACLP MVP — backend B-01 → B-14 | Auth, models, APIs, Celery, OpenAPI | ✅ Done (270 tests) |
| ACLP MVP — frontend F-01 → F-13 | Pages, auth, mocks, calendar, notifications, dashboard | ✅ Done |
| F-X polish (X-02 → X-05) | Dark accent theme, role rename, participant counts, admin attendance | ✅ Done |
| Bug-fix sweep (N-01 → N-04) | File upload/download, dev switcher, participant_task_qs, Publish button | ✅ Done |
| Pre-production hardening | Rate limit, forgot-password fix, magic-byte validation, hash-chain audit | 🟡 Open |
| Production rollout | Domain, SSL, systemd, Sentry, Postgres backups | 🟡 Pending domain |

## 12. Approvals

| Role | Name | Signature | Date |
|---|---|---|---|
| Product owner | Rutvik Prajapati | — | — |
| Engineering | Rutvik Prajapati | — | — |
| Compliance / Security | (TBD) | — | — |

---
*This BRD reverse-engineered from source on 2026-05-28; verify against current repo before approval.*
