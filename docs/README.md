# ACLP Training Management System — Documentation Set

**Generated:** 2026-05-28
**Method:** Reverse-engineered from source via parallel multi-agent analysis
**Scope:** Backend (Django REST API), Frontend (React SPA), Infrastructure (Azure VM)

> **Note on naming.** The repository folder is `Employee Managment` and many code-level identifiers say "EMS"; the **product name is `ACLP Training Management System`** (Adani Corporate Leadership Programme training portal). Documentation uses ACLP; codebase identifiers are unchanged.

---

## Documentation Index

| # | Document | Purpose | Audience |
|---|---|---|---|
| 1 | [BRD.md](BRD.md) | Business Requirements Document — scope, business rules, acceptance criteria, risks | Product, Stakeholders |
| 2 | [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | C4-level architecture, component map, ERD, lifecycle flows | All engineers |
| 3 | [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Every REST endpoint with method, path, body, returns, auth | Frontend, integrators |
| 4 | [ROLE_PERMISSION_MATRIX.md](ROLE_PERMISSION_MATRIX.md) | Admin vs Participant capability matrix; enforcement points | Product, Security |
| 5 | [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Threat model + vulnerabilities (prioritised) + hardening roadmap | Security, Compliance |
| 6 | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Azure VM bootstrap, systemd, Nginx, env, rollback, ops runbook | DevOps, SRE |
| 7 | [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md) | Static-analysis perf review + recommendations | Backend engineers |
| 8 | [SCALABILITY_REPORT.md](SCALABILITY_REPORT.md) | Bottleneck map + roadmap to 10× | Architecture |
| 9 | [FEATURE_MATRIX.md](FEATURE_MATRIX.md) | One row per feature: purpose, files, APIs, models, status, risks | Product, QA |
| 10 | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Onboarding, conventions, recipes for adding endpoints/notifications | New engineers |

## Scorecard

| Dimension | Score | Verdict |
|---|:-:|---|
| **Maturity** | 7.5 / 10 | Strong feature coverage; pre-prod hardening remains |
| **Security** | 6.2 / 10 | Solid foundation; rate-limit + forgot-password fix required |
| **Performance** | 7.0 / 10 | Acceptable at MVP scale; tuning opportunities documented |
| **Scalability** | 6.0 / 10 | Stateless backend; clear path to 10× via Phases A–C |
| **Production Readiness** | 6.5 / 10 | Single-VM SPOF + 3 blocking security items keep this below 8 |

## Open Blockers Before Go-Live

1. **Forgot-password flow** — token not persisted (SECURITY_AUDIT §3 #1)
2. **No rate limiting** anywhere (SECURITY_AUDIT §3 #2)
3. **`SetPasswordSerializer.validate_password()` bypass** (SECURITY_AUDIT §3 #3)
4. **`/dev/upload` and `/dev/download` `AllowAny`** — DEBUG-gate or strip from URLConf (SECURITY_AUDIT §3 #5)
5. **No CI pipeline** — manual `pytest` + `npm run build` only
6. **No error monitoring** — Sentry SDK not wired (frontend or backend)

## Verified Tech Stack

- **Frontend:** React 18.3 · TypeScript 5.5 · Vite 5.4 · Tailwind 3.4 · shadcn/ui · TanStack Query 5.59 · Zustand 5 · React Hook Form 7 + Zod 3 · FullCalendar 6 · Recharts 2.13 · Axios 1.7 · MSW 2.6
- **Backend:** Django 5.0.9 · DRF 3.15.2 · simple-jwt 5.3 · psycopg 3.2 · django-redis 5.4 · Celery 5.4 · drf-spectacular 0.27 · argon2-cffi 23.1 · django-storages 1.14 + azure-storage-blob 12.23
- **Infra:** Azure VM (D2s_v3, Ubuntu 22.04) · Azure DB Flex Postgres 15 B2s · Azure Blob Storage · Redis 7 (Docker) · Nginx · Gunicorn 3 workers · systemd · Let's Encrypt

## How to Use This Set

- **Stakeholder review** → start with `BRD.md` + `FEATURE_MATRIX.md`
- **New engineer onboarding** → `DEVELOPER_GUIDE.md` + `TECHNICAL_ARCHITECTURE.md`
- **Pre-prod hardening sprint** → `SECURITY_AUDIT.md` §9 roadmap
- **Production deployment** → `DEPLOYMENT_GUIDE.md` step by step
- **Sales / capacity questions** → `SCALABILITY_REPORT.md`

## Verification Log (transparency)

These documents were assembled in two passes:
1. **Pass 1** — Four sub-agents read the real source (models, urls.py, views, serializers, settings, frontend router/store/api-client, package.json) and returned structured summaries. The doc set was written from those summaries.
2. **Pass 2** — I (the main agent) personally re-read the highest-risk source files and corrected anything wrong.

### Personally re-verified by main agent on 2026-05-28

| Claim | File checked | Result |
|---|---|---|
| JWT 15min access / 7d refresh / HS256 / rotation+blacklist | `backend/config/settings/base.py` lines 144-154 | ✅ Confirmed |
| `IsAuthenticated` is the global DRF default | `backend/config/settings/base.py` line 131-133 | ✅ Confirmed |
| No `DEFAULT_THROTTLE_CLASSES` anywhere | `backend/config/settings/base.py` (REST_FRAMEWORK block) | ✅ Confirmed — no throttling |
| `SetPasswordSerializer` skips `validate_password()` | `backend/apps/accounts/serializers.py:24-26` | ✅ Confirmed — only `min_length=8` |
| `ChangePasswordSerializer` does call `validate_password()` | `backend/apps/accounts/serializers.py:37-41` | ✅ Confirmed |
| Forgot-password creates no `PasswordSetupToken` row | `backend/apps/accounts/views.py:139-160` + `services.py:57-84` | ✅ Confirmed — `consume_setup_token` requires a row that forgot-password never creates; flow is broken |
| `LogoutView` is `AllowAny` and swallows blacklist errors | `backend/apps/accounts/views.py:93-108` | ✅ Confirmed |
| `AuditLog.save/delete` raise `PermissionError` | `backend/apps/audit/models.py:33-39` | ✅ Confirmed — ORM-level only, bulk SQL bypasses |
| Notification has 12 type choices | `backend/apps/notifications/models.py:8-21` | ✅ Confirmed — exact 12 enums |
| `MePhotoView` allowed MIME types | `backend/apps/accounts/views.py:204` | ✅ `{jpeg, png, webp, gif}` — **SVG NOT in this list** (initial doc was wrong; corrected) |
| `ALLOWED_IMAGE_TYPES` in common/file_validation | `backend/apps/common/file_validation.py:24-32` | ⚠️ Includes `image/svg+xml` — XSS vector via documents/shared uploads (corrected SECURITY_AUDIT #8) |
| Dev views `permission_classes=[AllowAny]` but DEBUG-gated inside | `backend/apps/assignments/dev_views.py:14-36` | ⚠️ Confirmed — runtime check `if not settings.DEBUG: return 403` mitigates if `DEBUG=False`, but `blob_name` is **not** sanitised against path traversal (corrected SECURITY_AUDIT #5) |
| `production.py` missing `SECURE_PROXY_SSL_HEADER`, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_REFERRER_POLICY` | `backend/config/settings/production.py` (13 lines total) | ✅ Confirmed |
| JWT cookie SameSite=Lax dev / Strict prod | `base.py:158` + `production.py:5` | ✅ Confirmed |
| Argon2 + PBKDF2 password hashers, 4 default validators | `base.py:92-102` | ✅ Confirmed |
| Top-level URL routing structure | `backend/config/urls.py` | ✅ Confirmed |

### Taken from agent summaries (NOT individually re-verified by main agent)

- Every individual URL pattern in `apps/*/urls.py` (the agent enumerated 60+ routes; spot-checked top-level only)
- Every model field on the 18 listed models (the agent listed them; I confirmed AuditLog and Notification directly)
- Frontend route table, Zustand store contents, package.json versions, vite.config.ts (agent-read only)
- DB index lists in PERFORMANCE_REPORT (taken from agent's model summary)
- Celery beat task names — the README and `base.py` line 200-221 match, but I only confirmed 5 of the 6 in code (the `attendance_closing_soon_warning` task is dynamic/eta-based per the README; not in static beat schedule)

### Known divergences from README I did NOT chase down

- README mentions `attendance_closing_soon_warning` as a beat schedule entry; `base.py` does not list it in `CELERY_BEAT_SCHEDULE`. README is correct that it fires dynamically via `apply_async(eta=...)` from session start — not a periodic task. Did not re-verify the dispatch code.
- README mentions `/admin/settings/force-logout` endpoint — agent listed it; did not re-read the view code.

### If you want stronger guarantees

Run the doc set through `/ultrareview` or a fresh independent agent pass; alternatively, point me at any specific claim and I will re-read the source to confirm or correct.

---
*Each document carries its own date stamp and was generated from the source tree on 2026-05-28. Re-generate after material refactors.*
