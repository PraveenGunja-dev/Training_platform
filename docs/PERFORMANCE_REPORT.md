# Performance Report

**System:** ACLP Training Management System
**Assessment date:** 2026-05-28
**Target load (MVP):** ≤ 500 active users · ≤ 50 concurrent · ≤ 50 RPS
**Overall performance score: 7 / 10 — acceptable for MVP; clear improvement areas for 10× scale**

---

## 1. Test Methodology

This report is **derived from static analysis** (DB indexes, query patterns, payload sizes, caching strategy, frontend bundle, polling intervals). No load test was executed in this session; recommended actions include running k6 + Locust against staging before go-live.

## 2. Frontend Performance

### 2.1 Bundle
| Metric | Value | Comment |
|---|---|---|
| Production bundle (gzip) | ~568 KB | Acceptable for SPA; FullCalendar + Recharts dominate |
| Initial JS chunks | 3–4 | Vite default chunking |
| Tree-shaking | enabled | TS strict |
| Code-splitting per route | ❌ none explicit | All pages eagerly imported in `router/index.tsx` |
| Image assets | served via Azure Blob SAS | OK |

**Recommendations**
- Lazy-import admin-only heavy pages (`AdminCalendarPage`, `AuditLogPage`, `AnalyticsPage`) to shrink first-paint by ~150 KB
- Replace `xlsx` (~400 KB raw) with on-demand dynamic import for the audit export feature
- Replace `framer-motion` with lighter `react-aria` `motion` primitives where possible

### 2.2 Runtime Patterns
| Pattern | Cost | Comment |
|---|---|---|
| 10-second poll for active attendance | 0.1 req/s/user | Fine at MVP; SSE/WebSocket better at 1k+ users |
| TanStack Query default cache | 5 min staleTime | Good — prevents over-fetching |
| Notifications bell | 60-second refetch + cursor pagination | OK |
| Dashboard fetch | per-mount + 5-min stale | Backed by `DashboardSnapshot` cache row |

### 2.3 Network
- Axios uses `withCredentials: true` (refresh cookie) — Adds 1 round-trip on 401 (refresh queue prevents thundering-herd ✅)
- All endpoints return `{data, errors, meta?}` envelope — predictable serialisation cost
- File uploads go **directly to Blob via SAS** → Gunicorn never sees the file body (huge win)

## 3. Backend Performance

### 3.1 Database Indexes (observed)

| Table | Indexes |
|---|---|
| `accounts_user` | role, email (unique) |
| `groups_classgroup` | name (unique), ordering by name |
| `groups_groupmembership` | (user,group) unique, (group,user) |
| `scheduling_class` | (group, starts_at), (starts_at) |
| `attendance_session` | (class_obj,status), (started_at), unique partial ACTIVE per class |
| `attendance_record` | (session,user) unique |
| `documents_document` | (group, visibility), (class_obj) |
| `documents_participantshareddoc` | (status, created_at), (group, status) |
| `assignments_task` | (group, deadline_at), (deadline_at), (is_open, deadline_at) |
| `assignments_submission` | (task,user,version) unique, (task,user), (submitted_at) |
| `notifications_notification` | (user, read_at), (user, created_at), (dedupe_key) |
| `audit_log` | (actor,created_at), (target_type,target_id), (action,created_at) |

✅ Indexes cover the common access patterns (list-by-user-by-created-at, deadline scanning, audit filter).

### 3.2 Query Hotspots

| Endpoint | Likely query count | Risk |
|---|---|---|
| `/dashboard/admin` (cold) | 8–15 aggregations | Cached via `DashboardSnapshot` — 1 query if same day |
| `/dashboard/participant` | 4–6 | Adequate |
| `/notifications?cursor=` | 1 (indexed) + count | Fine |
| `/audit?…` | 1 | Cursor pagination prevents OFFSET drift |
| `/classes/?group=&from=&to=` | 1 (indexed) | Good |
| Celery `send_class_start_reminders` | scans classes 4–6 min ahead | Indexed on `starts_at` |
| Celery `open_due_tasks` | scans `upload_open_at <= now` | ⚠️ no index on `upload_open_at` — add (`is_open=False`, `upload_open_at`) partial |
| Celery `send_deadline_reminders` | scans deadlines per offset | indexed |

### 3.3 N+1 Risks
- Groups list with members nested → should use `prefetch_related("memberships__user")`. Verify in `apps/groups/serializers.py`.
- Class detail with participants_count — already cached on Class via memo (per F-X-05).
- Submissions list with task + user → ensure `select_related("task","user")`.

### 3.4 Caching Strategy
| Layer | Where | TTL |
|---|---|---|
| Server-side | `DashboardSnapshot` (one row per day) | 24 h |
| Server-side | Django cache (Redis db0) | per-key |
| Browser-side | TanStack Query staleTime | 5 min |
| Browser-side | Service-worker / MSW (dev) | n/a in prod |
| CDN | ❌ none | — |

**Gap**: no CDN, no `Cache-Control: public, max-age=…` on static SPA assets — Nginx alone serves them. Recommend Azure Front Door or Cloudflare in front for global edge.

### 3.5 Connection Pooling
- psycopg 3.2 connection pool: not explicitly configured — Django default `CONN_MAX_AGE`. Set `CONN_MAX_AGE = 60` in production for persistent connections.
- Redis: single connection pool managed by `django-redis` (default size 50) — adequate.

## 4. Concurrency Model

| Layer | Concurrency | Bottleneck |
|---|---|---|
| Nginx | event-loop, multi-worker | Not a bottleneck |
| Gunicorn | 3 sync workers | **Limits to ~9 in-flight requests** (recommended (2 × CPU) + 1 = 5 on D2s_v3) |
| Celery worker | concurrency=2 (default solo / prefork) | Tasks under 1 s — fine |
| Postgres | Flex Server B2s, 100 connections | Not a bottleneck at MVP |

**Recommendation**: increase Gunicorn to 5 workers; consider `gthread` worker class (4 workers × 4 threads) for I/O-bound mix.

## 5. Polling Overhead

10-second attendance poll per active participant:
- 50 participants × 1 req/10 s = **5 RPS** baseline → trivial
- 500 participants × 1 req/10 s = **50 RPS** sustained → still OK with 3 Gunicorn workers but begins to dominate logs
- At 1000+ participants, move to Server-Sent Events or WebSocket (`channels`)

## 6. Heavy-Lifting Operations

| Operation | Cost | Mitigation |
|---|---|---|
| File upload (video, 500 MB) | 0 on Gunicorn | Direct-to-Blob via SAS ✅ |
| Bulk CSV invite (1000 rows) | One transaction, email loop | Should be async-Celery task (currently in-request) |
| Dashboard aggregation | 8–15 queries | Snapshot cache ✅ |
| Audit export (XLSX) | client-side via `xlsx` | OK, but moves cost to browser |
| Attendance report download | single query | OK |

## 7. Synthetic Targets vs Static Analysis

| Target | Estimated | Verdict |
|---|---|---|
| p95 page TTI (broadband) | ~1.4 s | ✅ within 2 s budget |
| p95 dashboard API | ~120 ms (cached) / 600 ms (cold) | ✅ within 800 ms budget |
| p95 list endpoints | ~80 ms | ✅ |
| Max concurrent uploads | bounded by Azure Blob, not VM | ✅ |
| Notification fan-out (one class, 50 users) | 1 bulk insert (~30 ms) | ✅ |

## 8. Recommendations (prioritised)

| # | Action | Impact |
|---|---|---|
| 1 | Move CSV bulk-invite to Celery task; return job_id to frontend | UX + lower request latency |
| 2 | Add partial index on `assignments_task(upload_open_at) WHERE is_open=False` | Faster `open_due_tasks` beat |
| 3 | Lazy-import admin pages in `router/index.tsx` (`React.lazy`) | -150 KB first paint |
| 4 | Set `CONN_MAX_AGE=60` in production settings | Lower DB latency by ~5 ms/req |
| 5 | Front Nginx with Azure Front Door (or Cloudflare) | Global edge caching for SPA |
| 6 | Increase Gunicorn to 5 workers | +60% throughput headroom |
| 7 | Replace 10 s polling with SSE when concurrent participants > 200 | Lower RPS, lower p95 latency |
| 8 | Add Django `CACHE_MIDDLEWARE_SECONDS` for `/api/v1/classes/` admin view (5 s) | Cushion dashboard re-renders |
| 9 | Use `select_related` / `prefetch_related` audit (Django `silk` in staging) | Eliminate N+1 in list views |
| 10 | Compress responses (`gzip` on Nginx) — verify enabled | ~50% network savings on JSON |

## 9. Observability gaps that limit performance assertions

- ❌ No APM (Sentry Performance / OpenTelemetry / New Relic)
- ❌ No frontend RUM (Real User Monitoring)
- ❌ No DB slow-query log review documented
- ❌ No nightly performance regression test

These gaps mean numbers in this report are **best-effort estimates from code**. Before go-live, run a k6 script (sample below) against staging:

```js
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = { vus: 50, duration: '5m' };
export default function () {
  const r = http.get(`${__ENV.BASE}/api/v1/healthz`);
  check(r, { 'status 200': (x) => x.status === 200 });
  sleep(1);
}
```

## 10. Final Score Breakdown

| Category | Score |
|---|:-:|
| Frontend bundle size | 7 / 10 |
| Frontend runtime patterns | 8 / 10 |
| Backend query design | 8 / 10 |
| Indexing | 8 / 10 |
| Caching | 6 / 10 |
| Concurrency tuning | 6 / 10 |
| File-upload model | 9 / 10 (direct-to-Blob) |
| Observability | 4 / 10 |
| **Overall Performance Score** | **7.0 / 10** |

---
*Re-evaluate after load test in staging and after recommendations #1–#6 land.*
