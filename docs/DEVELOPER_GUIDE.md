# Developer Guide

**System:** ACLP Training Management System
**Repository:** https://github.com/Rutvik5o/EMS.git
**Audience:** New backend, frontend, and full-stack engineers joining the project

---

## 1. First Day Checklist

- [ ] Clone repo
- [ ] Install Node.js 20+, Python 3.11+, Docker, Git
- [ ] Read `README.md`, this guide, and `BRD.md`
- [ ] Run backend locally and hit `/api/v1/healthz`
- [ ] Run frontend in **mock mode** (`VITE_MOCK_API=true`) — full UI without backend
- [ ] Run frontend against local backend
- [ ] Run `pytest` (backend) and `npm run typecheck && npm run lint` (frontend)
- [ ] Read `apps/common/permissions.py`, `apps/accounts/views.py`, `src/lib/api-client.ts` end to end
- [ ] Skim `plan/` for design context (git-ignored locally if pulled later)

## 2. Local Setup

### 2.1 Backend
```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d        # Postgres 16 + Redis 7
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env                            # set SECRET_KEY=anything-random
python manage.py migrate
python manage.py seed_demo                             # 3 admins, 25 participants, etc.
python manage.py runserver
```
- API → `http://localhost:8000/api/v1/`
- Swagger → `http://localhost:8000/api/docs/`

### 2.2 Frontend
```powershell
cd frontend
npm ci
Copy-Item .env.example .env
# VITE_MOCK_API=true  → full UI from MSW seeds (no backend)
# VITE_MOCK_API=false → talks to localhost:8000
npm run dev                                            # http://localhost:5173
```

### 2.3 Seeded Credentials
| Role | Email | Password |
|---|---|---|
| Admin | kiran.nair@adani.com | password123 |
| Admin | manish@org.com | password123 |
| Participant | Rutvik.prajapati@adani.com | password123 |
| Participant | p2@org.com … p25@org.com | password123 |

## 3. Repo Layout

```
Employee Managment/
├── backend/
│   ├── apps/{accounts,users,groups,scheduling,attendance,assignments,documents,notifications,analytics,audit,common}/
│   ├── config/settings/{base,dev,production,test}.py
│   ├── config/{celery,urls,wsgi,asgi}.py
│   ├── manage.py
│   ├── requirements.txt
│   ├── pyproject.toml          # Ruff + mypy
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── api/                # axios modules per domain
│   │   ├── components/{layout,motion,states,ui}/
│   │   ├── features/{admin,participant,auth,charts,group-detail,notifications}/
│   │   ├── hooks/
│   │   ├── lib/{api-client,types}.ts
│   │   ├── mocks/              # MSW handlers + seed data
│   │   ├── pages/{admin,me,auth}/
│   │   ├── router/             # RoleGuard, RootRedirect, route table
│   │   ├── store/              # Zustand: auth.ts, settings.ts
│   │   └── styles/
│   ├── vite.config.ts
│   └── package.json
├── plan/                       # design docs (planning artefacts)
└── docs/                       # ← documentation (BRD, ARCH, API, etc.)
```

## 4. Conventions

### 4.1 Git
- Trunk-based; `main` always deployable
- Branch prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `test/`, `docs/`
- Commits: `type(scope): description` (Conventional Commits)
- Squash-merge to `main`; tag releases `v0.x.0`

### 4.2 Python
- Ruff + mypy (configured in `pyproject.toml`)
- Use type hints everywhere; mypy strict where possible
- One model per file is OK but app-level `models.py` is preferred when ≤ ~300 lines
- Permissions are declared per ViewSet via `permission_classes`; **never** rely solely on `IsAuthenticated` for admin actions — pair with `IsAdmin`
- Audit log via `apps.audit.services.log_action(actor, action, target_type, target_id, metadata)` — call from view, not signals
- Notifications via `apps.notifications.services.notify(user, type, ...)` with a meaningful `dedupe_key`

### 4.3 TypeScript
- Strict mode on
- `npm run lint -- --max-warnings 0` is mandatory
- Component files: PascalCase; hooks: `useXxx`; barrel exports avoided
- Form pattern: React Hook Form + Zod schema; never use native `<form>` validation
- HTTP: always go through `src/api/<domain>.ts` modules — never call `axios.get` from a page
- State: server state in TanStack Query, client state in Zustand
- Mutations: always call `queryClient.invalidateQueries` for affected keys
- Error handling: surface via `sonner` toast and `<ErrorState />` component

### 4.4 Naming
- Backend env vars: `UPPER_SNAKE`
- Frontend env vars: `VITE_` prefix required
- URL params: `kebab-case` paths, `snake_case` query keys
- DB tables: app-prefixed (`audit_log`, `common_system_settings`)

## 5. Adding a New Endpoint (recipe)

1. Add model fields (if needed) + `makemigrations`
2. Write/extend serializer
3. Add ViewSet or APIView with `permission_classes`
4. Wire URL in `apps/<app>/urls.py`
5. Add OpenAPI docstring (`@extend_schema`) for clean Swagger
6. Add `log_action` for write operations
7. Add `notify` if user-visible
8. Write pytest (factory_boy fixture) — see `apps/<app>/tests/`
9. Frontend: add `src/api/<domain>.ts` function, types, TanStack `useQuery`/`useMutation`, UI page
10. Update `BRD.md`/`API_DOCUMENTATION.md` if scope changes

## 6. Adding a New Notification Type

1. Add enum entry in `apps/notifications/models.py:Notification.Type`
2. Update `docs/FEATURE_MATRIX.md` and `docs/API_DOCUMENTATION.md`
3. Compose dispatcher in the originating service module
4. Decide `dedupe_key` strategy (`f"{type}:{user_id}:{target_id}"` is canonical)
5. Add deep-link path in `link` field; frontend bell auto-navigates
6. Add MSW handler so notification appears in mock dev mode
7. Test: write pytest that triggers the event and asserts `Notification.objects.filter(...).exists()`

## 7. Running Tests

```bash
# Backend
pytest                                 # 270 tests
pytest apps/attendance/tests -k mark   # narrow
pytest --cov                           # coverage

# Frontend
npm run typecheck
npm run lint
npm run build                          # ensure clean build
```

CI is **not yet configured** (open chore). Recommended GitHub Actions workflow in `.github/workflows/ci.yml`:
- Job `backend`: `pip install` + `pytest` + `ruff` + `mypy`
- Job `frontend`: `npm ci` + `typecheck` + `lint` + `build`

## 8. Common Pitfalls

| Pitfall | Avoid by |
|---|---|
| Forgetting `select_related` in list views → N+1 | Use Django Debug Toolbar / `silk` locally |
| Returning raw model fields (leaking PII) | Always go through DRF serializers |
| Hard-coding URLs in tests | Use `reverse()` |
| Calling `axios` directly from a page | Add a function in `src/api/<domain>.ts` |
| Mutating Zustand state | Use the setters; never spread state in place |
| Skipping `log_action` on a write endpoint | Audit gaps are caught only manually — be vigilant |
| Adding a Hindi/Hinglish string | English-only product (memory: `feedback_english_only_ui`) |
| Pinning a non-matrix-compatible package version | Verify compatibility (memory: `feedback_version_compatibility`) |

## 9. Useful Commands

```bash
# Backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo
python manage.py seed_showcase                 # rich showcase fixtures
python manage.py shell_plus                    # if django-extensions added

# Celery (true async; otherwise eager in dev)
celery -A config worker -l info --pool=solo
celery -A config beat -l info

# Frontend
npm run dev
npm run build
npm run preview                                # serve dist/ locally
```

## 10. Debugging Tips

- **401 loops** — check `withCredentials: true` in `api-client.ts` and that `/auth/refresh` is reachable; in dev, Vite proxies `/api` → `localhost:8000`
- **MSW not intercepting** — confirm `public/mockServiceWorker.js` exists and `VITE_MOCK_API=true`
- **SAS upload 403** — check `content_type` matches what frontend sends in `PUT`; SAS is bound to it
- **Celery beat not firing** — check `SchedulerHealth.last_heartbeat_at`; `/healthz` reports
- **Permission denied** — verify `permission_classes` includes `IsAdmin` for admin routes
- **Audit log empty** — `log_action` not called from the view

## 11. Style References

- Backend: PEP 8 + Ruff defaults + Django coding style
- Frontend: ESLint + TypeScript strict + Tailwind class ordering via `clsx` + `tailwind-merge`
- shadcn/ui components — extend rather than fork
- Markdown docs (this folder): one heading per concept, tables for matrices, fenced code with language tag

## 12. Where to Look for Domain Decisions

- `BRD.md` — business rules and acceptance criteria
- `TECHNICAL_ARCHITECTURE.md` — component map, lifecycle flows
- `ROLE_PERMISSION_MATRIX.md` — RBAC truth source
- `SECURITY_AUDIT.md` — open issues blocking go-live
- `plan/` folder — original product planning artefacts
- `.claude/projects/.../memory/*.md` — accumulated user preferences and per-feature decisions (F-09 → F-X-05, B-04 → B-14, I-01)

## 13. Contact / Ownership

- **Engineering owner:** Rutvik Prajapati
- **Issue tracker:** GitHub Issues on `Rutvik5o/EMS`
- **PR review:** `/ultrareview` available; otherwise tag owner

---
*Welcome aboard — start by getting the dev loop running, then pick a P0 item from FEATURE_MATRIX.md §13.*
