# Scalability Report

**System:** ACLP Training Management System
**Current capacity (estimated):** 500 concurrent users · 50 RPS sustained
**10× capacity (projected):** 5000 concurrent · 500 RPS — requires architectural changes below
**Overall scalability score: 6 / 10 — vertical scaling works to ~2×; horizontal scaling requires session/state extraction**

---

## 1. Current Capacity Estimate

| Dimension | MVP capacity | Bottleneck |
|---|---|---|
| Concurrent participants | ~500 | Gunicorn workers (3) |
| Sustained RPS | ~50 | Gunicorn workers + polling overhead |
| Peak burst | ~120 RPS for 30 s | Then 503/queue |
| Daily active users | ~1000 | DB unaffected |
| Storage (Blob) | ~10 TB / yr | Practically unlimited |
| DB size | ~50 GB / yr | Well within B2s |
| Notification fan-out | ~30 ms per 50 users | OK |
| Attendance live sessions | ~10 simultaneous | DB row contention low |

These are **estimated from code structure** (worker count, query patterns, polling interval). A k6 baseline before go-live is strongly recommended.

## 2. Scalability Profile per Component

| Component | Vertical | Horizontal | Notes |
|---|---|---|---|
| Nginx | ✅ trivial | ✅ trivial | Stateless |
| Gunicorn / Django | ✅ +workers / +CPU | ⚠️ requires session externalisation | JWT auth already stateless; sticky-session not needed |
| Celery worker | ✅ +concurrency | ✅ +nodes | Broker is shared Redis — bottleneck above 5k tasks/s |
| Celery beat | ❌ singleton | ❌ singleton | Must NOT be duplicated (would emit duplicates) — single-node HA only |
| Postgres | ✅ upgrade SKU | ⚠️ read replicas only | Writes funnel to primary |
| Redis | ✅ memory | ⚠️ requires Cluster mode | Cache + blacklist + broker all share one instance |
| Azure Blob | ✅ partition by prefix | ✅ unlimited | No tenant concern |
| SPA (Nginx static) | ✅ trivial | ✅ via CDN | Move to Azure Front Door |

## 3. Bottleneck Analysis (when traffic grows)

### 3.1 Gunicorn workers (first to hit)
At 3 sync workers × ~50 ms/req = **~60 RPS ceiling per VM**. Mitigations:
1. Increase to 5 workers (current VM has 2 vCPU — `(2 × CPU) + 1`)
2. Switch to `gthread` (4 workers × 4 threads) for I/O-bound mix
3. Move to second VM behind Azure Load Balancer (stateless thanks to JWT)

### 3.2 Postgres B2s (2 vCPU / 4 GB)
At ~50 RPS, p95 query time ~12 ms. At 250 RPS, expect contention:
- Upgrade to B4ms or General Purpose 2-vCPU (D2ds_v5)
- Add **read replica** for `/dashboard/admin`, `/audit` reads (10-15% load shift)
- Connection pooling via **PgBouncer** when worker count × CONN_MAX_AGE > 80

### 3.3 Redis (cache + broker + blacklist)
Single Redis on VM handles ~100k ops/s but consumes RAM with:
- JWT blacklist (7-day refresh window, ~N users × R rotations)
- Celery queues
- Django cache

Above 2k DAU, separate Redis instances for **cache** and **broker** (different ports / different Azure Cache for Redis tiers).

### 3.4 Celery beat (singleton)
Cannot duplicate without coordinator. At scale:
- Use **`django-celery-beat` DB scheduler** (already configured) — survives restarts
- Run as **active-passive** via systemd `Conflicts=` or a leader-lock pattern

### 3.5 Polling fanout
500 participants polling every 10 s → 50 RPS. At 2000 participants → 200 RPS just for polling. Move to:
- **Server-Sent Events** for attendance status (1 long-lived connection per user, near-zero overhead)
- **WebSockets via Django Channels + ASGI Uvicorn** if richer bi-directional events are added (chat, live grading)

### 3.6 Notification fanout
Currently bulk-creates `Notification` rows. At 50 participants → ~5 ms. At 5000 → ~300 ms (still fine within a Celery task). If push notifications (FCM / APNs / email) are added, must move to Celery + per-channel adapter.

## 4. Stateless vs Stateful Audit

| State | Where | Stateless? |
|---|---|---|
| Auth | JWT access + refresh cookie | ✅ stateless |
| Session | none (no Django session middleware for API) | ✅ |
| File uploads | Azure Blob (no local disk in prod) | ✅ |
| Profile photos | Azure Blob | ✅ |
| Audit log | Postgres | ✅ |
| Celery scheduler heartbeat | DB row `SchedulerHealth` | ✅ |
| Frontend client | localStorage (`ems-auth`, `ems-settings`) | ✅ per-browser |

✅ Backend is **fully stateless** for horizontal scaling, with the exception of Celery beat (singleton).

## 5. Roadmap to 10× scale

### Phase A — Vertical scale (≤ 2×, ≤ 1 sprint)
1. Gunicorn → 5 workers
2. CONN_MAX_AGE=60
3. Add partial index on `assignments_task(upload_open_at)`
4. Lazy-import admin pages → smaller initial bundle

### Phase B — Add CDN + read replica (≤ 5×, 1 sprint)
1. Azure Front Door in front of Nginx (cache `/static/*`, `/index.html`)
2. Postgres read replica + `dashboards` route to replica via Django DB router
3. Move CSV bulk-invite + bulk notifications to Celery

### Phase C — Horizontal app scale (≤ 10×, 2 sprints)
1. Second VM behind Azure LB; both run Gunicorn + Celery worker
2. Move Redis to **Azure Cache for Redis Standard** (separate cache + broker tiers)
3. PgBouncer in front of Postgres
4. Celery beat → single dedicated tiny VM (leader-lock)
5. Replace 10-s attendance polling with SSE (Django ASGI)

### Phase D — Multi-region & HA (long-term, ≥ 1 month)
1. Azure Traffic Manager → 2 regions, active-passive
2. Postgres geo-replication
3. Blob storage GZRS
4. Per-tenant org isolation (if multi-org sale happens)

## 6. Storage Growth Projections

Assumptions: 5 cohorts/year × 50 participants × 10 tasks × 50 MB avg + 100 docs/year × 25 MB

| Year | Submissions | Documents | Photos | Total |
|---|---|---|---|---|
| 1 | ~125 GB | ~2.5 GB | ~1 GB | ~130 GB |
| 3 | ~400 GB | ~8 GB | ~2 GB | ~410 GB |
| 5 | ~700 GB | ~15 GB | ~3 GB | ~720 GB |

Azure Blob handles this trivially; cost driver is egress (downloads). Mitigate via:
- Soft-delete + lifecycle policy: Hot → Cool after 90 d → Archive after 365 d
- Per-cohort container or prefix for batch deletion

## 7. Database Growth Projections

Heaviest table: `audit_log`. At 50 RPS × 8h × 250 working days = 360M audit rows/yr if every request logs. Realistically `log_action` is called ~5× per session → ~2M rows/yr. Mitigations:
- Partition `audit_log` by month (Postgres native partitioning)
- Archive partitions older than 12 months to Blob (Parquet) on a Celery monthly job

`notifications_notification` grows similarly (~1M/yr). Add a TTL or archive policy at 90 days.

## 8. Cost Curve (Azure illustrative)

| Stage | VM | DB | Redis | Blob | Front Door | Approx $/mo |
|---|---|---|---|---|---|---|
| MVP single VM | D2s_v3 | B2s | local | 130GB hot | — | ~$160 |
| Phase B | D2s_v3 | B4ms + replica | Standard C1 | 400GB | basic tier | ~$520 |
| Phase C | 2 × D2s_v3 + 1 tiny beat | GP D2ds_v5 + replica | Standard C2 | 700GB | standard | ~$1100 |
| Phase D | 2 regions × Phase C | geo-replica | Premium P1 | GZRS 1TB | premium WAF | ~$3400 |

## 9. Anti-patterns to Avoid as Load Grows

- ❌ Running multiple Celery beats (duplicate notifications)
- ❌ Storing files on Gunicorn host disk
- ❌ Increasing polling frequency below 10 s (linear cost growth)
- ❌ Adding synchronous email sending in request path (already off-loaded? verify)
- ❌ Eager loading every notification on page load (use cursor pagination — already done)
- ❌ `User.objects.all()` in any view (should always be paginated)

## 10. Final Scores

| Category | Score |
|---|:-:|
| Stateless backend | 9 / 10 |
| Database scaling readiness | 6 / 10 |
| Cache layer architecture | 6 / 10 |
| Background-job scalability | 6 / 10 |
| Frontend delivery (CDN-ready) | 5 / 10 |
| Storage model (Blob) | 9 / 10 |
| Multi-region readiness | 3 / 10 |
| Observability for scaling decisions | 4 / 10 |
| **Overall Scalability Score** | **6.0 / 10** |

---
*Re-evaluate after Phase A complete; sign-off Phase B before promising > 1000 concurrent users.*
