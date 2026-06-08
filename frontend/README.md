# EMS Frontend

React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + shadcn/ui

See the [root README](../README.md) for full project documentation, architecture, and role guide.

---

## Quick start

```powershell
npm ci
Copy-Item .env.example .env   # set VITE_MOCK_API=true for mock mode
npm run dev                   # http://localhost:5173
```

**Mock mode** (`VITE_MOCK_API=true`): the full UI works without the backend using MSW interceptors and seed data.

**Live mode** (`VITE_MOCK_API=false`): connects to the backend at `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`).

---

## Scripts

```powershell
npm run dev          # start Vite dev server
npm run build        # production build → dist/
npm run preview      # serve dist/ locally
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint (max-warnings 0)
```

---

## Source layout

```
src/
├── api/          # Axios API modules (one file per domain)
├── components/   # Shared: layout, motion, states, shadcn/ui
├── features/     # Feature components (admin/, participant/, auth/, ...)
├── hooks/        # Custom React hooks
├── lib/          # api-client.ts (JWT interceptors), types.ts
├── mocks/        # MSW handlers + mock seed data
├── pages/        # Route-level pages (admin/, participant/, auth/)
├── router/       # React Router config + RoleGuard
├── store/        # Zustand stores: auth.ts, settings.ts
└── styles/       # Global CSS
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base |
| `VITE_APP_NAME` | `Employee Management System` | App display name |
| `VITE_MOCK_API` | `true` | Enable MSW mock mode |
