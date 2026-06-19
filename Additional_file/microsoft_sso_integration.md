# Microsoft SSO Integration — ACLP Training Management System

**Stack:** React 18 + Vite + TypeScript / Django 5 + DRF / PostgreSQL / Azure VM  
**Date:** June 2026  
**Status:** Planning (no code changes done yet)

---

## What this doc covers

We want to add a "Sign in with Microsoft" button on the login page alongside the existing username/password flow. The whole point is that Adani employees already have Microsoft accounts (Azure AD / Entra ID), so they shouldn't need a separate password for this portal.

This is a plan doc — not a code PR. All the decisions we need to make and steps we need to take before touching code are laid out here.

---

## How the flow works (big picture)

1. User lands on `/login`, clicks "Sign in with Microsoft"
2. Browser gets redirected to `login.microsoftonline.com` (Microsoft's auth server)
3. User enters their org email/password (or it auto-logs in if they're already signed into Microsoft on that device)
4. Microsoft redirects back to our app with an authorization code
5. MSAL (the Microsoft auth library running in React) exchanges the code for two tokens — an **id token** (who the user is) and an **access token** (proof they can call our API)
6. React sends the access token to Django in every API request as `Authorization: Bearer <token>`
7. Django validates the token signature using Microsoft's public keys (downloaded automatically), extracts claims like email and object ID, and maps it to a Django user record

That's it. No passwords stored for SSO users on our side.

---

## Part 1 — Azure Portal Setup

This is the most important part and has to be done before any code changes. Get these wrong and nothing works.

### 1.1 Create two App Registrations

Go to **portal.azure.com → Microsoft Entra ID → App registrations**

We need two separate registrations — one for the frontend SPA, one for the backend API. They're separate because they have different security needs.

**Backend API registration** (call it `ACLP-API` or something obvious):
- Supported account types: single tenant (your org only)
- No redirect URI needed here
- After registering: go to **Expose an API**
  - Add an Application ID URI (accept the default `api://<client-id>`)
  - Add a scope — name it `access_as_user`
  - Who can consent: Admins and users
  - Save the full scope string, looks like: `api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/access_as_user`
- Go to **Certificates & secrets** → New client secret → copy the value immediately (you can't see it again)
- Record: Client ID, Tenant ID, Client Secret

**Frontend SPA registration** (call it `ACLP-Frontend`):
- No redirect URI during setup — add after
- After registering: go to **Authentication → Add a platform → Single-page application**
  - Add redirect URI: `http://localhost:5173` (Vite dev server)
  - Do NOT check the Implicit grant boxes (access tokens, ID tokens) — leave them unchecked
- Go to **API permissions → Add a permission → My APIs → ACLP-API → access_as_user → Add**
- Click "Grant admin consent" if required by your org
- Record: Client ID (the frontend one, different from backend)

### 1.2 Values you need to collect

| Thing | Where to find it |
|-------|-----------------|
| Tenant ID | Either app registration → Overview |
| Frontend Client ID | ACLP-Frontend → Overview |
| Backend Client ID | ACLP-API → Overview |
| Backend Client Secret | ACLP-API → Certificates & secrets |
| Scope URI | ACLP-API → Expose an API |

### 1.3 Production redirect URIs (add later, after domain is set up)

Once we have a domain and SSL working on the VM, come back here and add:
- `https://yourdomain.com` under ACLP-Frontend → Authentication → Single-page application section

Microsoft won't allow plain `http://` for non-localhost URIs. HTTPS is mandatory.

---

## Part 2 — Frontend Changes

We're using React 18 + Vite + TypeScript + Zustand + TanStack Query. The existing auth flow uses SimpleJWT tokens stored in the Zustand store (`src/store/auth.ts`) with axios interceptors in `src/lib/api-client.ts`.

The plan is to add MSAL alongside the existing flow — not replace it. Users with normal accounts still log in with username/password. SSO users go through Microsoft.

### 2.1 Packages to install

```
npm install @azure/msal-browser @azure/msal-react
```

`msal-react` is the React wrapper, `msal-browser` is the underlying library. Both are needed.

### 2.2 New file: `src/authConfig.ts`

This file holds the MSAL config object — tenant ID, client ID, redirect URI, and which scopes to request. All values come from env variables.

Key decisions:
- `cacheLocation: "sessionStorage"` — tokens don't persist after browser closes, which is what we want for a work portal
- No implicit grant — we're using Auth Code Flow with PKCE (the modern, secure way)
- Scope must include the `api://...` scope we defined in ACLP-API, not just `openid profile email`

### 2.3 Wrap the app with `MsalProvider`

In `src/main.tsx` — wrap the whole app with `<MsalProvider instance={msalInstance}>`. The `msalInstance` (a `PublicClientApplication`) must be created **outside** the component tree so it's not re-initialized on re-renders.

Also add an event listener for `LOGIN_SUCCESS` to automatically set the active account after login — this matters when the user has multiple Microsoft accounts.

### 2.4 The login button in `src/pages/auth/LoginPage.tsx`

Add a "Sign in with Microsoft" button below (or above) the existing form. Clicking it calls `instance.loginRedirect(loginRequest)` from the `useMsal` hook.

`loginRedirect` navigates away from our app and back. `loginPopup` keeps the user on the page but popup blockers can kill it. Redirect is the safer choice for enterprise users.

### 2.5 Sending the token to Django

Every API call needs to attach the Microsoft access token. The flow is:
1. Try `acquireTokenSilent` first (hits cache, no user interaction)
2. If that throws `InteractionRequiredAuthError`, fall back to `acquireTokenPopup`
3. Take the `accessToken` from the response and put it in `Authorization: Bearer <token>`

This probably means wrapping or extending our existing axios instance in `src/lib/api-client.ts` to handle MSAL token acquisition alongside the existing SimpleJWT refresh logic.

> **Important:** Send the `accessToken`, not the `idToken`. The access token is what Django is set up to validate. The id token is for the frontend to know who the user is.

### 2.6 Env variables needed (frontend)

Add to `.env` and `.env.example`:

```
VITE_AZURE_TENANT_ID=
VITE_AZURE_CLIENT_ID=          # Frontend app registration
VITE_AZURE_API_SCOPE=          # The api://... scope from ACLP-API
VITE_REDIRECT_URI=             # Override for production deployment
```

These get embedded into the JS bundle at build time by Vite. Never put secrets here.

---

## Part 3 — Backend (Django) Changes

Current setup: Django 5 + DRF + SimpleJWT + django-cors-headers (already installed). The accounts app handles auth.

### 3.1 Package to install

```
pip install PyJWT[crypto] cryptography requests
```

`PyJWT[crypto]` includes RSA support which is required because Microsoft signs tokens with RS256. The `cryptography` extra provides the key implementations. `requests` is for fetching Microsoft's public keys (usually already installed).

### 3.2 New file: custom DRF authentication class

Create something like `backend/apps/accounts/microsoft_auth.py`.

This class extends DRF's `BaseAuthentication`. It:
1. Pulls the Bearer token from the `Authorization` header
2. Uses `PyJWKClient` to fetch Microsoft's public signing keys from `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys`
3. Finds the right key using the `kid` in the token header
4. Calls `jwt.decode()` with the key, specifying `algorithms=["RS256"]`, `audience=AZURE_CLIENT_ID`, and `issuer` including the tenant ID
5. Extracts the `oid` claim and maps it to a Django user (get_or_create)

The `PyJWKClient` should be cached at module level so it isn't re-instantiated on every request. It also caches keys internally and handles key rotation.

> **Use `oid` not `sub` for the user identifier.** `sub` (subject) is unique per application registration in Azure AD. If we ever migrate or add another app registration, `sub` changes and we'd create duplicate user records. `oid` (Object ID) is stable for the user's lifetime in the tenant.

### 3.3 Settings changes

```python
# Add to REST_FRAMEWORK
"DEFAULT_AUTHENTICATION_CLASSES": [
    "apps.accounts.microsoft_auth.MicrosoftJWTAuthentication",  # new
    "rest_framework_simplejwt.authentication.JWTAuthentication",  # keep existing
    "rest_framework.authentication.SessionAuthentication",
]

# New settings
AZURE_TENANT_ID = env("AZURE_TENANT_ID")
AZURE_CLIENT_ID = env("AZURE_CLIENT_ID")   # Backend API client ID

# CORS — already have django-cors-headers, just make sure these are set
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://yourdomain.com",
]
```

### 3.4 Env variables needed (backend)

Add to `.env` and `.env.example`:

```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=          # ACLP-API (backend) client ID
AZURE_CLIENT_SECRET=      # Only needed if Django calls Graph API or other MS services
```

The client secret is NOT needed just for validating tokens — PyJWT validates using the public JWKS endpoint. Only add the secret if we later want Django to make outbound calls to Microsoft APIs.

---

## Part 4 — Azure VM / Infrastructure

### 4.1 HTTPS is not optional

Microsoft will flat-out refuse to redirect to a non-HTTPS URI in production. The Azure AD portal won't even let you save `http://yourdomain.com` as a redirect URI (localhost is the one exception).

Get SSL sorted first. Standard approach on an Azure VM:

```
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot sets up auto-renewal via cron. Run this before even trying to test SSO in production.

### 4.2 Azure VM Network Security Group

In the Azure portal, open inbound ports on the NSG for the VM:
- **Port 443** (HTTPS) — production traffic
- **Port 80** (HTTP) — needed for Let's Encrypt cert renewal challenges + redirect to HTTPS

Leave ports 8000 (Gunicorn), 5432 (Postgres), 6379 (Redis) closed to the internet.

### 4.3 nginx configuration

nginx should terminate TLS and proxy to Gunicorn. A sketch:

```
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 4.4 Django behind a proxy — required settings

Django needs to know it's running behind nginx so it correctly identifies requests as HTTPS:

```python
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

Without these, Django might generate `http://` URLs internally and things like CSRF validation or redirect URLs can break.

### 4.5 VM outbound access

The Django server needs to make outbound HTTPS calls to `login.microsoftonline.com` to fetch the JWKS public keys for token validation. Make sure the NSG and any firewall rules don't block outbound 443 traffic.

---

## Part 5 — Things that commonly go wrong

These are worth reading before starting implementation because they're not obvious.

### Wrong token audience (most common)

If you request a token without including your custom `api://...` scope, Microsoft gives you a token meant for its own Graph API. That token:
- Has `aud: 00000003-0000-0000-c000-000000000000` (Graph's app ID, not ours)
- Has a weird `nonce` field in the JWT header that breaks most validators

Fix: always include the `api://<backend-client-id>/access_as_user` scope in every token request from the frontend.

### Wrong platform type on redirect URI

When you add the redirect URI in Azure portal, you have to pick the platform type. For a React SPA it must be **Single-page application**, not "Web" and not "Public client/native". Using the wrong type disables PKCE and browser-side CORS for token exchange. The error you get is cryptic: `Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type`.

### Client secret expiry

Secrets created in Azure have a max lifetime of 24 months. Set a calendar reminder. An expired secret won't break token *validation* (that uses public keys), but it will break anything where Django needs to call Microsoft APIs using the client credentials flow. Rotating it means updating the VM's env variable and restarting Gunicorn.

### Token expiry and silent refresh

Azure access tokens expire in 60–90 minutes. MSAL handles this automatically via `acquireTokenSilent`, which uses the refresh token (24-hour lifetime) to get a new access token without user interaction. If both expire, the user has to log in again. We need to handle `InteractionRequiredAuthError` in the code and redirect to login.

### `oid` vs `sub` for user matching

Covered above but worth repeating: use `oid`, not `sub`. The `sub` claim is scoped per-application in Azure AD v2. `oid` is the user's permanent object ID in the tenant.

---

## Quick checklist before starting

**Azure Portal:**
- [ ] Backend API app registration created, `access_as_user` scope exposed
- [ ] Frontend SPA app registration created with **SPA platform** redirect URI (not "Web")
- [ ] API permission added from frontend to backend scope, admin consent granted
- [ ] All four values recorded: tenant ID, frontend client ID, backend client ID, backend client secret
- [ ] Implicit grant checkboxes are unchecked
- [ ] Production HTTPS redirect URI added (after SSL is set up)

**Frontend:**
- [ ] `@azure/msal-browser` and `@azure/msal-react` packages installed
- [ ] MSAL config file created with env-variable-based settings
- [ ] `MsalProvider` wrapping the app, `PublicClientApplication` created outside component tree
- [ ] Login button triggers `loginRedirect` with scopes including the API scope
- [ ] Token acquisition uses silent first, interactive fallback
- [ ] API calls attach `accessToken` (not `idToken`) in Authorization header
- [ ] Env variables added to `.env` and `.env.example`

**Backend:**
- [ ] `PyJWT[crypto]` and `cryptography` installed, added to `requirements.txt`
- [ ] Custom `BaseAuthentication` class written, validates against JWKS, uses `oid` for user lookup
- [ ] Added to `DEFAULT_AUTHENTICATION_CLASSES` alongside existing SimpleJWT
- [ ] `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` in settings (from env)
- [ ] CORS configured for frontend origin

**VM:**
- [ ] Port 443 and 80 open in NSG
- [ ] SSL cert from Certbot
- [ ] nginx reverse proxy configured
- [ ] `SECURE_PROXY_SSL_HEADER` and `USE_X_FORWARDED_HOST` in Django settings
- [ ] VM has outbound internet access to `login.microsoftonline.com`

---

## Notes on co-existence with existing auth

We're NOT replacing SimpleJWT. Existing admin/manager/instructor accounts that were created with username+password should keep working exactly as they do now. The plan:

- Login page has two paths: form (existing) and Microsoft button (new)
- Django's `DEFAULT_AUTHENTICATION_CLASSES` will have both authenticators — DRF tries them in order
- If the `Authorization` header contains a Microsoft JWT (RS256, `aud` = our backend client ID), the Microsoft authenticator handles it
- If it contains a SimpleJWT token, the SimpleJWT authenticator handles it
- Both resolve to a Django User object, so the rest of the app doesn't care which was used

One thing to decide before coding: what role gets assigned to a user who signs in via Microsoft for the first time and has no existing record? Options: default to `participant`, require an admin to pre-create the account, or read a group claim from Azure AD to auto-assign roles. This is a product decision, not a technical one.
