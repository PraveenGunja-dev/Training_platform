# Role & Permission Matrix

**System:** ACLP Training Management System
**Roles:** `ADMIN`, `PARTICIPANT` (the `MANAGER` role was deliberately removed; legacy data is auto-coerced to `ADMIN` at frontend rehydration)

---

## 1. Role Definitions

| Role | Identifier | Description |
|---|---|---|
| Admin | `ADMIN` | L&D operator. Full read/write on all entities. Receives every system notification. |
| Participant | `PARTICIPANT` | Trainee. Read/write scoped to their own data and the groups they are a member of. |

## 2. Authentication Flow

| Step | Endpoint | Role required |
|---|---|---|
| Sign in | `POST /auth/login` | Public |
| Refresh access token | `POST /auth/refresh` | Public (cookie) |
| Sign out | `POST /auth/logout` | Authenticated |
| Set initial password (invite) | `POST /auth/set-password` | Public (token-gated) |
| Forgot password | `POST /auth/forgot-password` | Public |
| Change own password | `POST /me/password` | Authenticated |

## 3. Endpoint Permission Matrix

Legend: ✓ = full access · 👁️ = read-only · ◐ = scoped to self / own group · ✗ = denied

| Endpoint family | Admin | Participant |
|---|:-:|:-:|
| `/users/*` | ✓ | ✗ |
| `/users/{id}/resend-invite` | ✓ | ✗ |
| `/groups/` (list) | ✓ | ◐ (member-of only) |
| `/groups/` (create/edit/archive) | ✓ | ✗ |
| `/groups/{id}/participants` | ✓ | ✗ |
| `/groups/{id}/analytics` | ✓ | ✗ |
| `/classes/` (list) | ✓ | ◐ (member-of only) |
| `/classes/` (create/edit/cancel) | ✓ | ✗ |
| `/me/calendar` | ✓ (own) | ✓ (own) |
| `/admin/attendance/sessions/*` | ✓ | ✗ |
| `/admin/attendance/records/{id}` (override) | ✓ | ✗ |
| `/attendance/active-session` | ✓ | ✓ |
| `/attendance/sessions/{id}/mark` | ✓ | ✓ (member-of class) |
| `/assignments/` (list) | ✓ | ◐ (in own groups) |
| `/assignments/` (create/edit/delete/close) | ✓ | ✗ |
| `/assignments/{id}/submissions` (GET) | ✓ | ◐ (own only) |
| `/assignments/{id}/submissions` (POST) | ✓ (on-behalf) | ✓ (self) |
| `/me/tasks`, `/me/submissions` | ✓ (own) | ✓ |
| `/submissions/{id}/download` | ✓ | ◐ (own) |
| `/documents/` (list) | ✓ | ◐ (visibility-filtered) |
| `/documents/` (create/edit/delete) | ✓ | ✗ |
| `/documents/{id}/download` | ✓ | ◐ (visibility-checked) |
| `/admin/groups/{id}/upload-permissions/*` | ✓ | ✗ |
| `/me/upload-permissions` | ✓ (none) | ✓ |
| `/groups/{id}/shared-upload-url` | ✗ | ✓ (if permitted) |
| `/groups/{id}/shared-uploads` | ✓ | ✓ (own) |
| `/admin/shared-uploads/*` | ✓ | ✗ |
| `/notifications/*` | ✓ (own) | ✓ (own) |
| `/dashboard/admin` / `/dashboard/manager` | ✓ | ✗ |
| `/dashboard/participant` | ✓ (own) | ✓ |
| `/audit` | ✓ | ✗ |
| `/admin/settings` (GET/PATCH) | ✓ | ✗ |
| `/admin/settings/force-logout` | ✓ | ✗ |
| `/healthz` | ✓ | ✓ |
| `/me`, `/me/password`, `/me/photo` | ✓ (own) | ✓ (own) |

## 4. Feature-Capability Matrix

| Capability | Admin | Participant |
|---|:-:|:-:|
| Invite single user | ✓ | — |
| Bulk-invite via CSV | ✓ | — |
| Resend invite | ✓ | — |
| Edit user role | ✓ | — |
| Deactivate user | ✓ | — |
| Create / edit / archive group | ✓ | — |
| Add / remove participants in group | ✓ | — |
| View per-group analytics | ✓ | — |
| Create / edit / cancel class | ✓ | — |
| View admin calendar (all groups) | ✓ | — |
| View own calendar | ✓ | ✓ |
| Start / end attendance session | ✓ | — |
| Override individual attendance record | ✓ | — |
| Download session attendance report | ✓ | — |
| Mark self present (within window) | — | ✓ |
| Create assignment task | ✓ | — |
| Upload question file | ✓ | — |
| Publish / close assignment | ✓ | — |
| Submit assignment | — | ✓ |
| Submit on participant's behalf | ✓ (ADMIN_ONLY tasks) | — |
| Review / download submissions | ✓ | own only |
| Upload document to library | ✓ | — |
| Set document visibility | ✓ | — |
| Download document (per visibility) | ✓ | ✓ if entitled |
| Grant participant upload permission | ✓ | — |
| Submit shared upload | — | ✓ (if permitted) |
| Approve / reject shared upload | ✓ | — |
| Promote shared upload to library | ✓ | — |
| View own notifications | ✓ | ✓ |
| Receive every system notification | ✓ | — |
| View audit log | ✓ | — |
| Edit system settings | ✓ | — |
| Force-logout all users | ✓ | — |

## 5. Visibility & Scoping Rules

### 5.1 Document visibility
| Visibility | Who sees it |
|---|---|
| `GROUP` | All current members of `document.group` |
| `SELECTED` | Users in `document.allowed_user_ids` AND in the group |
| `STAFF_ONLY` | Admins only |
| `PUBLIC_TO_CLASS` | Anyone whose `class_obj` matches the document's class (e.g. attendance roster) |

### 5.2 Class visibility
- Admin: all classes
- Participant: classes where `class.group` is in their `GroupMembership` set

### 5.3 Assignment & submission visibility
- Admin sees every submission
- Participant sees only own submissions, only when `task.is_open=True` AND `task.upload_open_at <= now`
- After `deadline_at`: late policy determines what is accepted

### 5.4 Attendance
- Admin can open / end / override
- Participant can mark only when an `ACTIVE` session exists AND they are in `class.group`
- 10-second polling on `/attendance/active-session` updates participant UI

## 6. Why Manager was removed

Originally the system planned a Manager role between Admin and Participant. Removed because:
1. **Scope confusion** — Manager and Admin had ≥ 80% overlap in capabilities
2. **Compliance** — fewer permission tiers = clearer audit trail
3. **Implementation cost** — every endpoint required a third decision branch
4. **Stakeholder feedback** — Adani L&D team confirmed single-Admin model matched real workflow

Backward compatibility: legacy `MANAGER` role data is rewritten to `ADMIN` in:
- Frontend Zustand auth store rehydration (`src/store/auth.ts`)
- `/dashboard/manager` endpoint is aliased to admin dashboard (no 404 for stale clients)

## 7. Permission Enforcement Points

| Layer | Mechanism |
|---|---|
| URL routing | DRF `IsAuthenticated` global default |
| Class-level | `IsAdmin` (`role == "ADMIN"`) on admin-only views |
| Object-level | `IsParticipantInGroup` checks `GroupMembership` |
| Queryset scoping | All participant-facing list views filter to user's groups |
| Frontend | `<RoleGuard role="ADMIN" />` plus layout-level redirects in `AdminLayout` / `ParticipantLayout` |
| Refresh cookie | HttpOnly + Secure + SameSite=Strict (prod), scoped to `/api/v1/auth/refresh` |

## 8. Known Gaps

1. **No formal object permission on assignments/documents** — relies on queryset filtering. A participant who knows another user's task UUID and bypasses the list endpoint can probe detail endpoints; queryset filter usually catches this but defence in depth is missing.
2. **`/dev/*` endpoints are `AllowAny`** — must be DEBUG-gated in production.
3. **Logout is `AllowAny`** — silently swallows blacklist errors.
4. **Forgot-password reuses signed-timestamp tokens not persisted in DB** — single-use semantics not enforced (open security issue).

---
*Cross-references: API_DOCUMENTATION.md §1-§15, SECURITY_AUDIT.md §3.*
