# Security Audit

**System:** ACLP Training Management System
**Audit date:** 2026-05-28
**Auditor:** Reverse-engineered analysis from source
**Overall score: 6.2 / 10 — Good foundations, several pre-production hardening items required**

---

## 1. Executive Summary

The codebase shows a security-conscious foundation: JWT with rotation + blacklist, Argon2 password hashing, HSTS in prod, HttpOnly refresh cookie, append-only audit log, SAS-scoped uploads, and email enumeration mitigation on forgot-password. However, several material gaps prevent a clean go-live signoff:

- ❗ **No rate limiting** anywhere (brute-force / enumeration risk on `/login`, `/forgot-password`, `/refresh`)
- ❗ **Forgot-password flow does not persist or single-use the reset token** (logic divergence from invite)
- ❗ **`SetPasswordSerializer` (invite flow) skips `validate_password()`** — only enforces `min_length=8`
- ⚠️ Audit log immutability enforced only at Python ORM layer (bulk SQL bypasses)
- ⚠️ `/dev/upload`, `/dev/download` use `AllowAny` permission class (mitigated by runtime `if not settings.DEBUG: return 403` check, but no path-traversal sanitisation on `blob_name`)
- ⚠️ `MePhotoView` MIME type taken from client header, no magic-byte verification (allowed: jpeg/png/webp/gif — SVG NOT in this list)
- ⚠️ `apps/common/file_validation.py:ALLOWED_IMAGE_TYPES` **does** include `image/svg+xml` (used by documents + shared-upload paths) — stored XSS vector if served same-origin
- ⚠️ SAS tokens signed with full storage account key; no protocol pin

## 2. Threat Model (STRIDE summary)

| Threat | Asset | Current control | Residual risk |
|---|---|---|---|
| Credential stuffing on login | User accounts | Argon2 hashing | **High** — no throttle |
| Token replay | JWT access | 15-min TTL | Low |
| Refresh-token theft | Cookie | HttpOnly + Secure + SameSite=Strict (prod) | Low–Medium (XSS-resistant but no DPoP) |
| Audit-log tampering | Compliance evidence | Python `save/delete` overrides raise | Medium — bulk SQL bypass |
| File upload abuse | Blob storage | SAS scoped to blob + content_type + 15min | Low–Medium — MIME spoofable |
| Direct object reference | Submissions, docs | Queryset scoping | Medium — no `has_object_permission` |
| Email enumeration | User base | Forgot returns 202 always | Low |
| Brute-force forgot-password | User base | None | **High** |
| Path traversal on dev upload | VM filesystem | DEBUG flag | Medium if mis-deployed |
| Stored XSS via uploaded SVG (documents / shared uploads — not profile photo) | Participant browsers | None | Medium |
| Account takeover via weak invite password | New users | `min_length=8` | Medium |

## 3. Vulnerabilities (prioritised)

| # | Severity | Title | Detail | Recommended fix |
|---|---|---|---|---|
| 1 | **High** | Forgot-password token not persisted | `TimestampSigner` token returned to user but no `PasswordSetupToken` row created. Consumption path expects a row → flow likely broken or single-use not enforced | Mirror invite flow: hash token, persist with `consumed_at`, validate on `/set-password` |
| 2 | **High** | No rate limiting on login / forgot / refresh / change-password | Open to credential stuffing and enumeration | Nginx `limit_req` (5/min/IP) + `django-ratelimit` per user + global |
| 3 | **High** | `SetPasswordSerializer` skips `validate_password()` | Common-password validator bypassed at invite consumption | Call `validate_password(value, user=user)` in `validate_password` method |
| 4 | **Medium** | Audit log immutability is Python-only | `.update()`, `.delete()` on querysets, raw SQL all bypass `save`/`delete` overrides | Add Postgres trigger `BEFORE UPDATE OR DELETE ON audit_log RAISE EXCEPTION`; consider hash-chain (`prev_hash + sha256(row)`) for tamper-evidence |
| 5 | **Medium** | `/dev/upload/{blob_name}`, `/dev/download/{blob_name}` have `permission_classes=[AllowAny]` and lack path-traversal sanitisation | Views DO check `if not settings.DEBUG: return 403` (mitigated for production with DEBUG=False); but `blob_name` flows unsanitised into `os.path.join` → traversal possible in dev or if DEBUG ever flipped | Strip the URLs from URLConf when `not settings.DEBUG`; sanitise `blob_name` via `os.path.basename` + reject `..` / absolute paths; add temp-token requirement even in dev |
| 6 | **Medium** | Single SECRET_KEY signs JWTs + invite tokens + reset tokens | Compromise = full account takeover + token forgery | Use separate `SimpleJWT.SIGNING_KEY` (or RS256 with rotating key); separate signer for invite/reset |
| 7 | **Medium** | SAS tokens signed with storage account key | Key exposure compromises entire container | Switch to **user-delegation SAS** via Managed Identity; pin `protocol="https"` |
| 8 | **Medium** | Client `content_type` trusted (no magic-byte sniff). `MePhotoView` allowlist is safe (jpeg/png/webp/gif). However `apps/common/file_validation.py:ALLOWED_IMAGE_TYPES` includes `image/svg+xml` and is used by documents + shared-upload flows | XSS via `<svg><script>` if served same-origin | Verify magic bytes (`Pillow.Image.open`); drop `image/svg+xml` from `ALLOWED_IMAGE_TYPES`; serve all user uploads from a separate origin (`uploads.<host>`) with `Content-Disposition: attachment` |
| 9 | **Low** | `/refresh` accepts cookie with no CSRF token | Mitigated by SameSite=Strict in prod, but Lax in dev allows top-level POSTs | Issue a `__Host-csrf` cookie + require `X-CSRF-Token` echo on `/refresh` |
| 10 | **Low** | Missing prod security headers | `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_REFERRER_POLICY`, `SECURE_PROXY_SSL_HEADER`, `CSP` | Enable in `production.py` + Nginx `add_header` |
| 11 | **Low** | `LogoutView` swallows blacklist errors | Operational blind spot | Log with severity WARNING; emit Sentry breadcrumb |
| 12 | **Low** | Email normalization only lowercases the domain | Potential duplicate accounts | Lowercase entire email at registration; add CI lint |
| 13 | **Info** | `IsParticipantInGroup` falls back to `obj.id` if `group_id` missing | If applied to wrong model, can leak | Make fallback raise instead |
| 14 | **Info** | Notifications `dedupe_key` not validated against length/charset | Theoretical DoS if attacker can choose keys | Limit length; namespace by user |

## 4. Configuration Review

### 4.1 `base.py`
- `SIMPLE_JWT.ACCESS_TOKEN_LIFETIME` = 15 min ✅
- `SIMPLE_JWT.REFRESH_TOKEN_LIFETIME` = 7 days ✅
- `SIMPLE_JWT.ROTATE_REFRESH_TOKENS` = True ✅
- `SIMPLE_JWT.BLACKLIST_AFTER_ROTATION` = True ✅
- `PASSWORD_HASHERS` = `[Argon2, PBKDF2…]` ✅
- `AUTH_PASSWORD_VALIDATORS` = standard 4 (similarity, min-length 8, common-password, numeric) ⚠️ min-length should be 12

### 4.2 `production.py`
- `SECURE_SSL_REDIRECT` = True ✅
- `SECURE_HSTS_SECONDS` = 31_536_000 ✅
- `SECURE_HSTS_INCLUDE_SUBDOMAINS` = True ✅
- `SECURE_HSTS_PRELOAD` = True ✅
- `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` / `JWT_REFRESH_COOKIE_SECURE` = True ✅
- ❌ `SECURE_PROXY_SSL_HEADER` not set → redirect loop possible behind a TLS-terminating proxy
- ❌ `SECURE_CONTENT_TYPE_NOSNIFF` not set
- ❌ `SECURE_REFERRER_POLICY` not set
- ❌ `Content-Security-Policy` header missing

### 4.3 CORS
- `CORS_ALLOWED_ORIGINS` whitelisted via env ✅
- `CORS_ALLOW_CREDENTIALS = True` (required for refresh cookie) ✅
- ⚠️ Ensure prod CORS list does not contain `*` or development origins

## 5. Authentication Detail

### 5.1 Login (`/auth/login`)
- Argon2 password verify
- Returns access JWT in body + refresh cookie
- ❌ No throttle → credential stuffing exposure

### 5.2 Refresh (`/auth/refresh`)
- Reads refresh from HttpOnly cookie
- Rotates → new refresh + old blacklisted in Redis
- Returns new access in body
- ⚠️ No CSRF token

### 5.3 Logout
- `AllowAny`; swallows errors
- ⚠️ Should log failures

### 5.4 Invite / set-password
- 48-hour TimestampSigner token
- SHA-256 hashed in `PasswordSetupToken`; single-use via `consumed_at` ✅
- ❌ Password validator weak (min-length only)

### 5.5 Forgot-password
- Email enumeration mitigated (202 always) ✅
- ❌ Token not persisted; single-use not enforceable
- ❌ No throttle

### 5.6 Change-password (`/me/password`)
- Argon2 re-hash
- Invalidates all OutstandingTokens ✅
- ❌ No throttle

## 6. Data Protection

| Data | At rest | In transit | Notes |
|---|---|---|---|
| Passwords | Argon2 (industry standard) | HTTPS | ✅ |
| JWT access tokens | (transient, not persisted) | HTTPS | ✅ |
| Refresh tokens | Hashed in `OutstandingToken`; blacklist in Redis | HttpOnly cookie + HTTPS | ✅ |
| Invite tokens | SHA-256 in DB | HTTPS | ✅ |
| Reset tokens | ❌ Not persisted | HTTPS | Open issue #1 |
| User PII (email, name, photo) | Postgres encrypted at rest (Azure default) | HTTPS | ✅ |
| Uploaded files | Azure Blob (SSE) | HTTPS via SAS | ✅ |
| Audit log | Postgres (no encryption-at-rest beyond Azure default) | HTTPS | ⚠️ no tamper-evidence |

## 7. Logging & Monitoring

| Signal | Captured | Where to improve |
|---|---|---|
| Failed login attempts | ❌ not explicit | Log + counter + Sentry |
| Account lockouts | ❌ none | Implement |
| Audit-log writes | ✅ `log_action` called from views | Add signal-driven fallback |
| 5xx errors | Django logging | Wire Sentry SDK |
| JWT blacklist failures | ❌ swallowed | Promote to WARNING |
| SAS issuance | ❌ none | Add structured log line |

## 8. Compliance Posture

| Framework | Status | Gap |
|---|---|---|
| GDPR (data subject rights) | ⚠️ partial | No automated export / delete; manual via Admin user CRUD |
| ISO 27001 (access control) | ⚠️ partial | No formal review cadence |
| SOC 2 (audit trail) | ⚠️ partial | Tamper-evidence missing |
| OWASP ASVS L2 | ⚠️ partial | Rate limiting, password policy, MIME sniffing gaps |

## 9. Recommended Hardening Roadmap

| Sprint | Items |
|---|---|
| Pre-prod #1 | Fix forgot-password persistence (#1) + rate limiting (#2) + `SetPasswordSerializer.validate_password` (#3) |
| Pre-prod #2 | Magic-byte MIME verification + drop SVG (#8); prod security headers (#10); CSP via Nginx |
| Post-launch #1 | Postgres trigger immutability on audit_log (#4); hash-chain audit |
| Post-launch #2 | User-delegation SAS via Managed Identity (#7); separate JWT signing key (#6) |
| Post-launch #3 | Sentry + structured JSON logging; failed-login counters |

## 10. Final Scores

| Category | Score |
|---|:-:|
| Authentication design | 7 / 10 |
| Password handling | 7 / 10 |
| Authorization (RBAC) | 7 / 10 |
| Data protection | 8 / 10 |
| Audit & tamper-evidence | 5 / 10 |
| Input validation | 6 / 10 |
| Rate limiting | 2 / 10 |
| Configuration hardening | 6 / 10 |
| Logging & monitoring | 5 / 10 |
| **Overall Security Score** | **6.2 / 10** |

---
*Audit conducted against repo state on 2026-05-28; re-audit after each hardening sprint.*
