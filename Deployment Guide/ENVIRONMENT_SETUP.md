# ACLP Training Management System — Production Environment Setup

Complete guide for configuring all environment variables and secrets for production deployment. Written for a deployment engineer who has never worked on this project.

---

## Overview

The system uses a single environment file on the production server at `/etc/app/env`. This file is read by the Django application via `EnvironmentFile=` in each systemd service unit.

**Security rules:**
- Never commit this file to Git
- File permissions: `0640` (owner read/write, group read, others nothing)
- Owner: `aclp:aclp` (the application user)
- Store a backup copy in Azure Key Vault

---

## Complete Environment File Template

Create `/etc/app/env` with the following content, replacing all `<placeholder>` values:

```dotenv
# ============================================================
# ACLP Training Management System — Production Environment
# ============================================================
# File: /etc/app/env
# Permissions: chmod 0640, chown aclp:aclp
# NEVER commit this file to Git
# ============================================================

# --- Django Settings ---
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<generate-64-char-random-key>
DEBUG=False

# --- Allowed Hosts ---
# Your production domain, comma-separated
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# --- CORS ---
# The exact URL of your frontend (protocol + domain, no trailing slash)
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# --- Frontend URL ---
# Used in invite and password reset email links
FRONTEND_URL=https://yourdomain.com

# --- Database (Azure PostgreSQL Flexible Server) ---
# Format: postgres://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
DATABASE_URL=postgres://aclp_user:<db-password>@<server-name>.postgres.database.azure.com:5432/aclp?sslmode=require

# --- Redis (local Docker on VM) ---
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1

# --- Celery ---
# Do NOT set CELERY_TASK_ALWAYS_EAGER in production (tasks must be async)

# --- Email (SMTP) ---
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=<smtp-app-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=ACLP TMS <noreply@yourdomain.com>

# --- Azure Blob Storage ---
AZURE_ACCOUNT_NAME=<azure-storage-account-name>
AZURE_ACCOUNT_KEY=<azure-storage-account-key>
AZURE_CONTAINER=aclp-prod
DEV_LOCAL_STORAGE=False

# --- Feature Flags ---
INSTRUCTOR_ROLE_ENABLED=True

# --- Error Tracking (optional but recommended) ---
# SENTRY_DSN=https://<key>@sentry.io/<project-id>
```

---

## Variable-by-Variable Reference

### DJANGO_SETTINGS_MODULE

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.production
```

**What it does:** Tells Django which settings file to use. Always use `config.settings.production` on the production server. Never use `config.settings.dev` or `config.settings.test` in production.

---

### SECRET_KEY

```dotenv
SECRET_KEY=<64-char-random-string>
```

**What it does:** Django's cryptographic signing key. Used for JWT tokens, CSRF tokens, and sessions. If this key leaks, all tokens are compromised.

**Generate it:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Rules:**
- Must be at least 50 characters
- Must be unique per environment (dev ≠ prod)
- Never share or commit
- Rotate it if you suspect it was exposed (all users will be logged out)

---

### DEBUG

```dotenv
DEBUG=False
```

**What it does:** `True` shows full error pages in the browser (never use in production). `False` hides error details and enables production mode.

**Always `False` in production.**

---

### ALLOWED_HOSTS

```dotenv
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

**What it does:** Django rejects HTTP requests where the `Host` header doesn't match this list (prevents host-injection attacks).

**Set to your exact domain names only.** Do not use `*` in production.

---

### CORS_ALLOWED_ORIGINS

```dotenv
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

**What it does:** The browser's Cross-Origin Resource Sharing (CORS) policy. Only listed origins can make API requests from JavaScript.

**Must exactly match** the protocol and domain that serves the frontend. No trailing slash.

---

### FRONTEND_URL

```dotenv
FRONTEND_URL=https://yourdomain.com
```

**What it does:** Base URL prepended to links in invitation and password reset emails. If wrong, email links will be broken.

---

### DATABASE_URL

```dotenv
DATABASE_URL=postgres://aclp_user:MyP@ssw0rd@myserver.postgres.database.azure.com:5432/aclp?sslmode=require
```

**Format breakdown:**

```
postgres://  USERNAME  :  PASSWORD  @  HOST  :  PORT  /  DBNAME  ?sslmode=require
```

| Part          | Example value                                   | Where to get it             |
| ------------- | ----------------------------------------------- | --------------------------- |
| USERNAME      | `aclp_user`                                     | Created during DB setup     |
| PASSWORD      | `MyP@ssw0rd`                                    | Created during DB setup     |
| HOST          | `myserver.postgres.database.azure.com`          | Azure Portal → PostgreSQL server → Overview |
| PORT          | `5432`                                          | Default PostgreSQL port     |
| DBNAME        | `aclp`                                          | Created during DB setup     |
| sslmode       | `require`                                       | Always `require` for Azure  |

**Test the connection:**
```bash
psql "postgres://aclp_user:<password>@<server>.postgres.database.azure.com:5432/aclp?sslmode=require" -c "SELECT version();"
```

---

### REDIS_URL / CELERY_BROKER_URL / CELERY_RESULT_BACKEND

```dotenv
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

**What they do:**
- `REDIS_URL`: Django cache backend (JWT blacklist, session cache)
- `CELERY_BROKER_URL`: Where Celery workers pick up tasks
- `CELERY_RESULT_BACKEND`: Where Celery stores task results
- Database `0` and `1` are separate Redis logical databases (no conflict)

**Verify Redis is running:**
```bash
redis-cli -h 127.0.0.1 -p 6379 ping
# Expected: PONG
```

---

### Email Variables

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=<app-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=ACLP TMS <noreply@yourdomain.com>
```

**EMAIL_BACKEND options:**
- `django.core.mail.backends.smtp.EmailBackend` — real SMTP (production)
- `django.core.mail.backends.console.EmailBackend` — prints to console (dev only)

**Common SMTP host values:**

| Provider     | HOST                   | PORT |
| ------------ | ---------------------- | ---- |
| Microsoft 365| `smtp.office365.com`   | 587  |
| Gmail        | `smtp.gmail.com`       | 587  |
| SendGrid     | `smtp.sendgrid.net`    | 587  |
| AWS SES      | `email-smtp.<region>.amazonaws.com` | 587 |

**Test email sending (Django shell):**
```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py shell -c "
from django.core.mail import send_mail
send_mail(\"Test\", \"This is a test email from ACLP TMS.\", None, [\"your-email@domain.com\"])
print(\"Email sent successfully\")
"
'
```

---

### Azure Blob Storage Variables

```dotenv
AZURE_ACCOUNT_NAME=aclpprod
AZURE_ACCOUNT_KEY=ABCdef123...==
AZURE_CONTAINER=aclp-prod
DEV_LOCAL_STORAGE=False
```

| Variable             | Where to find it                                                    |
| -------------------- | ------------------------------------------------------------------- |
| `AZURE_ACCOUNT_NAME` | Azure Portal → Storage Accounts → [Account name shown at top]      |
| `AZURE_ACCOUNT_KEY`  | Azure Portal → Storage Account → Security + networking → Access keys → Key 1 |
| `AZURE_CONTAINER`    | The container name you created (e.g., `aclp-prod`)                 |
| `DEV_LOCAL_STORAGE`  | Must be `False` in production — never `True`                        |

**Test Blob Storage access:**
```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py shell -c "
from azure.storage.blob import BlobServiceClient
client = BlobServiceClient(account_url=f\"https://{__import__(\"os\").environ[\"AZURE_ACCOUNT_NAME\"]}.blob.core.windows.net\", credential=__import__(\"os\").environ[\"AZURE_ACCOUNT_KEY\"])
containers = [c.name for c in client.list_containers()]
print(\"Containers found:\", containers)
"
'
```

---

### INSTRUCTOR_ROLE_ENABLED

```dotenv
INSTRUCTOR_ROLE_ENABLED=True
```

**What it does:** Feature flag that enables the Instructor role in the system. When `True`, users with role `INSTRUCTOR` can be assigned to groups and manage their groups' classes, attendance, and assignments. When `False`, only Admin and Participant roles are active.

---

### SENTRY_DSN (Optional)

```dotenv
SENTRY_DSN=https://abc123@o12345.ingest.sentry.io/67890
```

**What it does:** When set, all unhandled Django errors are reported to Sentry with full stack traces. Helps catch production errors before users report them.

**Get the DSN:**
1. Create a project at https://sentry.io
2. Select "Django" as the platform
3. Copy the DSN from the setup screen

---

## Setting File Permissions

After creating the file:

```bash
# Set ownership to the application user
sudo chown aclp:aclp /etc/app/env

# Set permissions: owner can read/write; group can read; others nothing
sudo chmod 0640 /etc/app/env

# Verify
ls -la /etc/app/env
# Should show: -rw-r----- 1 aclp aclp
```

---

## Frontend Environment

The frontend is a static React build. The frontend `.env` is set at build time, not runtime. Create it before running `npm run build`:

```bash
sudo -u aclp bash -c 'cat > /srv/aclp/app/frontend/.env << EOF
VITE_API_BASE_URL=https://yourdomain.com/api/v1
VITE_APP_NAME=ACLP Training Management System
VITE_MOCK_API=false
EOF'
```

| Variable            | Production value                              |
| ------------------- | --------------------------------------------- |
| `VITE_API_BASE_URL` | `https://yourdomain.com/api/v1`               |
| `VITE_APP_NAME`     | `ACLP Training Management System` (or custom) |
| `VITE_MOCK_API`     | `false` — must never be `true` in production  |

---

## Verifying Environment

After setting up all environment variables and starting services, verify:

```bash
# Check Django can read all settings
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py check --deploy
'
```

Expected: `System check identified no issues (0 silenced).`

Any warnings shown by `--deploy` should be investigated and resolved.

---

## Secrets Rotation

### Rotating SECRET_KEY

Rotating changes what tokens are valid:

1. Generate new key: `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`
2. Update `/etc/app/env`
3. **All users will be logged out** (JWT tokens are invalidated)
4. Restart Gunicorn: `sudo systemctl restart aclp-gunicorn`

### Rotating Database Password

1. Change password in Azure Portal: PostgreSQL → Users → [user]
2. Update `DATABASE_URL` in `/etc/app/env`
3. Restart all services: `sudo systemctl restart aclp-gunicorn aclp-worker aclp-beat`

### Rotating Azure Storage Key

1. Generate a new key in Azure Portal: Storage Account → Access Keys → Rotate Key
2. Update `AZURE_ACCOUNT_KEY` in `/etc/app/env`
3. Restart Gunicorn: `sudo systemctl restart aclp-gunicorn`
