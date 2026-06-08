# ACLP Training Management System — Complete Deployment Guide

**Version:** 1.0  
**Target environment:** Azure VM (single host) — Standard_D2s_v3, Ubuntu 22.04  
**External services:** Azure Database for PostgreSQL Flexible Server · Azure Blob Storage · SMTP relay  
**Prepared for:** Deployment engineers with no prior project knowledge

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pre-Flight Checklist](#2-pre-flight-checklist)
3. [Azure Resource Provisioning](#3-azure-resource-provisioning)
4. [VM Bootstrap (One-Time Setup)](#4-vm-bootstrap-one-time-setup)
5. [Application Layout on Disk](#5-application-layout-on-disk)
6. [Environment File Configuration](#6-environment-file-configuration)
7. [Code Deployment](#7-code-deployment)
8. [systemd Service Units](#8-systemd-service-units)
9. [Nginx Configuration](#9-nginx-configuration)
10. [SSL Certificate](#10-ssl-certificate)
11. [Health Check & Smoke Tests](#11-health-check--smoke-tests)
12. [Backups & Disaster Recovery](#12-backups--disaster-recovery)
13. [Routine Operations](#13-routine-operations)
14. [Rollback Procedure](#14-rollback-procedure)
15. [Monitoring & Alerting](#15-monitoring--alerting)
16. [Security Hardening](#16-security-hardening)
17. [Open Issues Before Go-Live](#17-open-issues-before-go-live)
18. [Restoring from Database Dump](#18-restoring-from-database-dump)

---

## 1. Architecture Overview

```
                          ┌─────────────────────────┐
   Internet ──443──▶ Nginx │  TLS terminator         │
                           │  • / (SPA React dist)   │
                           │  • /api/v1/* (Gunicorn) │
                           │  • /static/ (files)     │
                           └────────┬────────────────┘
                                    │  unix:/run/aclp.sock
                           ┌────────▼────────────────┐
                           │  Gunicorn (3 workers)   │
                           │  Django 5 + DRF         │
                           └────────┬────────────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
     ┌───────▼───────┐    ┌─────────▼────────┐   ┌────────▼──────────┐
     │ Postgres 15   │    │ Redis 7 (docker) │   │ Celery worker+beat │
     │ Azure Flex DB │    │ on VM localhost  │   │ (systemd units)    │
     └───────────────┘    └──────────────────┘   └────────────────────┘
                                                           │
                                                 ┌─────────▼─────────┐
                                                 │  Azure Blob       │
                                                 │  Storage (SAS)    │
                                                 └───────────────────┘
```

### Key Components

| Component        | Role                                                          |
| ---------------- | ------------------------------------------------------------- |
| Nginx            | Reverse proxy, TLS termination, static file serving           |
| Gunicorn         | WSGI server, 3 sync workers, communicates via Unix socket     |
| Django + DRF     | REST API backend, business logic, JWT auth                   |
| Celery Worker    | Background task processing (email, notifications)             |
| Celery Beat      | Scheduled task runner (reminders, auto-open tasks, analytics) |
| PostgreSQL 15    | Primary relational database (hosted on Azure Flex Server)     |
| Redis 7          | JWT blacklist, Celery broker, cache (Docker container on VM)  |
| Azure Blob       | File storage (questions, submissions, documents) via SAS URLs |
| React SPA        | Frontend (pre-built static files served by Nginx)            |

---

## 2. Pre-Flight Checklist

Complete all of these before starting the deployment:

- [ ] Azure subscription with sufficient quota (VM B-series + DB Flex + Blob Storage)
- [ ] Domain name registered and DNS A-record pointing to the VM public IP
- [ ] Azure Blob Storage account created; container `aclp-prod` created (Private access)
- [ ] Azure PostgreSQL Flexible Server provisioned; firewall allows VM IP
- [ ] SMTP credentials obtained (Microsoft 365 or SendGrid recommended)
- [ ] GitHub access to `https://github.com/Rutvik5o/EMS`
- [ ] 64-character random `SECRET_KEY` generated (keep this secret):
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(64))"
  ```
- [ ] (Recommended) Sentry project created for error tracking
- [ ] (Recommended) UptimeRobot or similar uptime monitoring configured

---

## 3. Azure Resource Provisioning

### 3.1 Virtual Machine

1. Create VM in Azure Portal:
   - **Image:** Ubuntu Server 22.04 LTS
   - **Size:** Standard_D2s_v3 (2 vCPUs, 8 GB RAM) — minimum recommended
   - **Authentication:** SSH public key (upload your public key)
   - **Inbound ports:** 22 (SSH), 80 (HTTP), 443 (HTTPS)
   - **OS disk:** Premium SSD, 64 GB minimum
2. Assign a static public IP address to the VM
3. Note the public IP address for DNS configuration

### 3.2 PostgreSQL Flexible Server

1. Create Azure Database for PostgreSQL Flexible Server:
   - **Tier:** Burstable B2s (2 vCores, 4 GB RAM)
   - **PostgreSQL version:** 15
   - **Admin username:** `aclp_admin`
   - **Admin password:** Generate a strong password (save it)
2. Under Networking:
   - Add VM's **private IP** to the firewall allowlist
   - Enable SSL enforcement
3. Create a database:
   ```sql
   CREATE DATABASE aclp;
   CREATE USER aclp_user WITH PASSWORD 'strong-password-here';
   GRANT ALL PRIVILEGES ON DATABASE aclp TO aclp_user;
   ```
4. Note the server hostname (format: `*.postgres.database.azure.com`)

### 3.3 Blob Storage

1. Create a Storage Account in Azure Portal:
   - **Performance:** Standard
   - **Replication:** LRS (Locally Redundant Storage) — upgrade to GRS for production
   - **Access tier:** Hot
2. Create a container named `aclp-prod`:
   - **Public access level:** Private (no anonymous access)
3. Get the Storage Account Name and Key:
   - Azure Portal → Storage Account → Access Keys → Show Keys
   - Copy Key 1

---

## 4. VM Bootstrap (One-Time Setup)

SSH into the VM as the default `azureuser` (or however you named the admin user):

```bash
ssh azureuser@<VM-PUBLIC-IP>
```

### 4.1 OS Update and Dependencies

```bash
sudo apt update && sudo apt -y upgrade

sudo apt -y install \
  nginx git \
  python3.11 python3.11-venv python3-pip \
  build-essential libpq-dev \
  ca-certificates curl \
  ufw fail2ban
```

### 4.2 Node.js 20 (Required for Frontend Build)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 4.3 Docker (for Local Redis)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Log out and back in for group membership to take effect
exit
ssh azureuser@<VM-PUBLIC-IP>

# Start Redis container
docker run -d \
  --name redis \
  --restart=always \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine

# Verify
docker ps | grep redis
redis-cli ping  # → PONG
```

### 4.4 Firewall Configuration

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

Expected output:
```
Status: active
To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
```

### 4.5 Application User

```bash
# Create dedicated app user (no password login)
sudo adduser --disabled-password --gecos "" aclp

# Create required directories
sudo mkdir -p /srv/aclp /etc/app /var/log/aclp
sudo chown -R aclp:aclp /srv/aclp /var/log/aclp
sudo chmod 750 /etc/app

# Verify
ls -la /srv/aclp
```

---

## 5. Application Layout on Disk

```
/srv/aclp/
├── app/                    # git clone of the repository
│   ├── backend/            # Django application
│   ├── frontend/           # React source
│   └── frontend/dist/      # Built React SPA (generated by npm run build)
└── venv/                   # Python virtual environment

/etc/app/env                # Production secrets (mode 0640, aclp:aclp)

/etc/systemd/system/
├── aclp-gunicorn.service   # Gunicorn web server
├── aclp-worker.service     # Celery background worker
└── aclp-beat.service       # Celery scheduled task runner

/etc/nginx/sites-available/aclp.conf  # Nginx site configuration

/var/log/aclp/
├── access.log              # HTTP access log
└── error.log               # Application error log

/srv/aclp/app/backend/staticfiles/   # Django collected static files
```

---

## 6. Environment File Configuration

Create the secrets file on the server. This file contains sensitive credentials and must **never** be committed to Git.

```bash
sudo nano /etc/app/env
```

Paste and fill in all values:

```dotenv
# Django settings
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<paste-your-64-char-random-key-here>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database (Azure PostgreSQL Flexible Server)
DATABASE_URL=postgres://aclp_user:<password>@<flex-server>.postgres.database.azure.com:5432/aclp?sslmode=require

# Redis (local Docker on VM)
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1

# Email (SMTP — Microsoft 365 example)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=<app-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=ACLP TMS <noreply@yourdomain.com>

# Azure Blob Storage
AZURE_ACCOUNT_NAME=<storage-account-name>
AZURE_ACCOUNT_KEY=<storage-account-key>
AZURE_CONTAINER=aclp-prod
DEV_LOCAL_STORAGE=False

# Feature flags
INSTRUCTOR_ROLE_ENABLED=True

# Optional: Sentry error tracking
SENTRY_DSN=https://<key>@sentry.io/<project-id>
```

Set secure permissions:
```bash
sudo chown aclp:aclp /etc/app/env
sudo chmod 0640 /etc/app/env

# Verify
ls -la /etc/app/env
# Should show: -rw-r----- 1 aclp aclp
```

---

## 7. Code Deployment

### 7.1 Clone Repository

```bash
sudo -u aclp bash -c '
  cd /srv/aclp
  git clone https://github.com/Rutvik5o/EMS.git app
  echo "Clone complete. Branch: $(git -C app branch --show-current)"
'
```

### 7.2 Create Python Virtual Environment

```bash
sudo -u aclp bash -c '
  cd /srv/aclp
  python3.11 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install -r app/backend/requirements.txt
  echo "Python environment ready"
'
```

### 7.3 Database Migrations

```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
  echo "Migration and static files complete"
'
```

> `collectstatic` copies all Django static files to `/srv/aclp/app/backend/staticfiles/`. This is served by Nginx directly.

### 7.4 Frontend Build

```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/frontend
  
  # Create production .env
  cat > .env << EOF
VITE_API_BASE_URL=https://yourdomain.com/api/v1
VITE_APP_NAME=ACLP Training Management System
VITE_MOCK_API=false
EOF
  
  npm ci
  npm run build
  echo "Frontend build complete: $(ls dist/ | wc -l) files in dist/"
'
```

### 7.5 (Optional) Load Demo Data

Only run this on the first deployment if you want demo data:

```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py seed_demo
'
```

---

## 8. systemd Service Units

Create three systemd service files:

### 8.1 Gunicorn (Web Server)

```bash
sudo nano /etc/systemd/system/aclp-gunicorn.service
```

```ini
[Unit]
Description=ACLP Training Management System — Gunicorn
After=network.target

[Service]
User=aclp
Group=aclp
EnvironmentFile=/etc/app/env
WorkingDirectory=/srv/aclp/app/backend
ExecStart=/srv/aclp/venv/bin/gunicorn config.wsgi:application \
  --workers 3 \
  --bind unix:/run/aclp.sock \
  --access-logfile /var/log/aclp/access.log \
  --error-logfile /var/log/aclp/error.log \
  --timeout 60
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 8.2 Celery Worker (Background Tasks)

```bash
sudo nano /etc/systemd/system/aclp-worker.service
```

```ini
[Unit]
Description=ACLP Training Management System — Celery Worker
After=network.target

[Service]
User=aclp
Group=aclp
EnvironmentFile=/etc/app/env
WorkingDirectory=/srv/aclp/app/backend
ExecStart=/srv/aclp/venv/bin/celery -A config worker \
  -l info \
  --concurrency=2 \
  --logfile=/var/log/aclp/celery-worker.log
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 8.3 Celery Beat (Scheduler)

```bash
sudo nano /etc/systemd/system/aclp-beat.service
```

```ini
[Unit]
Description=ACLP Training Management System — Celery Beat
After=network.target

[Service]
User=aclp
Group=aclp
EnvironmentFile=/etc/app/env
WorkingDirectory=/srv/aclp/app/backend
ExecStart=/srv/aclp/venv/bin/celery -A config beat \
  -l info \
  --scheduler django_celery_beat.schedulers:DatabaseScheduler \
  --logfile=/var/log/aclp/celery-beat.log
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 8.4 Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable aclp-gunicorn aclp-worker aclp-beat
sudo systemctl start aclp-gunicorn aclp-worker aclp-beat

# Verify all running
sudo systemctl status aclp-gunicorn aclp-worker aclp-beat
```

All three should show `Active: active (running)`.

---

## 9. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/aclp.conf
```

```nginx
upstream aclp_app {
    server unix:/run/aclp.sock;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (filled in by certbot)
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https://*.blob.core.windows.net; connect-src 'self' https://*.blob.core.windows.net; style-src 'self' 'unsafe-inline'; script-src 'self'" always;

    # Allow large file uploads (SAS bypass means this is only for API calls)
    client_max_body_size 50M;

    # Serve React SPA
    root /srv/aclp/app/frontend/dist;
    index index.html;

    # Rate-limited auth endpoints
    location = /api/v1/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://aclp_app;
        include /etc/nginx/proxy_params;
    }

    # All other API requests
    location /api/ {
        proxy_pass http://aclp_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;
    }

    # Django static files
    location /static/ {
        alias /srv/aclp/app/backend/staticfiles/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # React SPA — all other paths serve index.html
    location / {
        try_files $uri /index.html;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/aclp.conf /etc/nginx/sites-enabled/
sudo nginx -t   # Test configuration
sudo systemctl reload nginx
```

---

## 10. SSL Certificate

```bash
sudo apt -y install certbot python3-certbot-nginx

# Issue certificate
sudo certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --redirect \
  --hsts \
  --staple-ocsp \
  --email your-email@domain.com \
  --agree-tos \
  --non-interactive

# Reload Nginx
sudo systemctl reload nginx
```

Certbot configures auto-renewal. Verify the timer is active:
```bash
sudo systemctl status certbot.timer
```

Test renewal:
```bash
sudo certbot renew --dry-run
```

---

## 11. Health Check & Smoke Tests

### 11.1 Health Endpoint

```bash
curl -fsS https://yourdomain.com/api/v1/healthz | python3 -m json.tool
```

Expected response:
```json
{
  "data": {
    "status": "ok",
    "db": "ok",
    "redis": "ok",
    "scheduler": {
      "last_heartbeat_at": "2026-06-01T12:00:30Z"
    }
  },
  "errors": []
}
```

### 11.2 End-to-End Smoke Test

1. Open `https://yourdomain.com` → login screen appears
2. Login as admin (`kiran.kr@adani.com` if demo data loaded)
3. Navigate to `/admin/dashboard` → KPI cards load
4. Create a test class → verify notification fires
5. Check Swagger UI: `https://yourdomain.com/api/docs/`
6. Login as participant → dashboard loads, today's class visible

---

## 12. Backups & Disaster Recovery

### 12.1 Database Backups

Azure PostgreSQL Flexible Server includes built-in backup:
- **Continuous WAL archiving** — point-in-time recovery (PITR)
- **Recovery window:** 7 days by default (increase to 35 days for critical workloads)
- **RTO:** ~30 minutes | **RPO:** 5 minutes

To restore to a specific point in time:
1. Azure Portal → PostgreSQL Flexible Server → Backup and restore
2. Select a point in time
3. Create a new server (do not overwrite production directly)
4. Test the restored database first
5. Update `DATABASE_URL` to point to restored server if needed

Manual backup (additional safety):
```bash
# Daily pg_dump (run as cron or manually)
PGPASSWORD=<password> pg_dump \
  -h <flex-server>.postgres.database.azure.com \
  -U aclp_user \
  -d aclp \
  --no-password \
  -Fc \
  > /var/backups/aclp-$(date +%F).dump

# Upload to Blob Storage for offsite backup
az storage blob upload \
  --account-name <storage-account> \
  --container-name aclp-backups \
  --name "db/aclp-$(date +%F).dump" \
  --file /var/backups/aclp-$(date +%F).dump
```

### 12.2 File Storage Backups

Azure Blob Storage:
- Enable **soft delete** (14-day retention recommended)
- Enable **geo-redundant storage (GRS)** for cross-region replication
- Configure in: Azure Portal → Storage Account → Data protection

### 12.3 Secrets Backup

The `/etc/app/env` file contains all secrets:
```bash
# Store in Azure Key Vault (recommended)
az keyvault secret set \
  --vault-name aclp-keyvault \
  --name env-production \
  --file /etc/app/env
```

### 12.4 Recovery Time Objectives

| Asset                | Backup Method              | RTO       | RPO       |
| -------------------- | -------------------------- | --------- | --------- |
| PostgreSQL database  | Azure PITR (continuous)    | 30 min    | 5 min     |
| Blob Storage files   | Soft delete + GRS          | 1 hour    | ~0 min    |
| Application code     | GitHub                     | 15 min    | per commit|
| Secrets (`/etc/app/env`) | Azure Key Vault       | 5 min     | per change|
| VM itself            | Azure VM backup (optional) | 1 hour    | 24 hours  |

---

## 13. Routine Operations

### Deploy a New Release

```bash
# Pull latest code
sudo -u aclp git -C /srv/aclp/app pull

# Backend: install new deps, migrate, collect static
sudo -u aclp bash -c '
  source /srv/aclp/venv/bin/activate
  pip install -r /srv/aclp/app/backend/requirements.txt
  cd /srv/aclp/app/backend
  set -a && source /etc/app/env && set +a
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
'

# Frontend: rebuild
sudo -u aclp bash -c '
  cd /srv/aclp/app/frontend
  npm ci
  npm run build
'

# Restart services
sudo systemctl restart aclp-gunicorn aclp-worker aclp-beat
```

### Restart Services

```bash
# Restart web server only (fastest, for code-only changes)
sudo systemctl restart aclp-gunicorn

# Restart all three services
sudo systemctl restart aclp-gunicorn aclp-worker aclp-beat
```

### View Logs

```bash
# Gunicorn real-time logs
sudo journalctl -u aclp-gunicorn -f

# Celery worker logs
sudo journalctl -u aclp-worker -n 100

# Celery beat logs
sudo journalctl -u aclp-beat -n 50

# Nginx access log
sudo tail -f /var/log/nginx/access.log

# Application error log
sudo tail -f /var/log/aclp/error.log
```

### Force Logout All Users

Via API (admin user must be logged in):
```bash
curl -X POST https://yourdomain.com/api/v1/admin/settings/force-logout \
  -H "Authorization: Bearer <admin-jwt-token>"
```

Or via the Admin UI: Settings → Force Logout All Users.

### Database Maintenance

```bash
# Connect to database
PGPASSWORD=<password> psql \
  -h <flex-server>.postgres.database.azure.com \
  -U aclp_user \
  -d aclp

# Run VACUUM ANALYZE (monthly recommended)
VACUUM ANALYZE;
```

### Management Commands

```bash
# Import participants from Excel (detu.xlsx)
python manage.py import_detu [--xlsx path/to/file.xlsx] [--dry-run]
# Creates groups, registers participants, assigns instructors from spreadsheet

# Clear all demo data (keeps kiran.kr@adani.com)
python manage.py clear_demo_data [--yes]
# Deletes all users except kiran.kr@adani.com, all groups, classes, assignments, attendance, docs

# Create a test class for QR feature testing (ends 2 min ago)
python manage.py create_qr_test_class
```

---

## 14. Rollback Procedure

If a deployment introduces a critical bug:

### Step 1 — Identify Previous Working Version

```bash
git -C /srv/aclp/app log --oneline -15
```

### Step 2 — Determine if Migrations Were Applied

```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py showmigrations | grep "\[X\]" | tail -10
'
```

### Step 3a — No New Migrations (Simple Rollback)

```bash
# Checkout previous version
sudo -u aclp git -C /srv/aclp/app checkout <previous-sha>

# Rebuild frontend
sudo -u aclp bash -c '
  cd /srv/aclp/app/frontend
  npm ci && npm run build
'

# Restart services
sudo systemctl restart aclp-gunicorn aclp-worker aclp-beat
```

### Step 3b — New Migration Applied (Database Rollback Needed)

> **Warning:** Django migrations are forward-only. If a migration was applied, you must restore the database from PITR.

1. In Azure Portal: Go to PostgreSQL Flexible Server → Backup and restore
2. Choose the point in time **before** the deployment
3. Restore to a **new server** (not the current one)
4. Update `DATABASE_URL` in `/etc/app/env` to point to the restored server
5. Checkout the previous code version
6. Restart services

### Step 4 — Run Smoke Tests

After rollback, run the [smoke test checklist](#111-health-endpoint) to verify the system is functional.

---

## 15. Monitoring & Alerting

### Health Endpoint

The system exposes a health check endpoint:
```
GET /api/v1/healthz
```

Response includes:
- `db`: PostgreSQL connectivity
- `redis`: Redis connectivity  
- `scheduler`: Last Celery beat heartbeat (checks Celery is running)

### Recommended Monitoring Setup

**UptimeRobot (free tier):**
1. Create a new monitor: HTTP(S) type
2. URL: `https://yourdomain.com/api/v1/healthz`
3. Monitoring interval: 5 minutes
4. Alert contacts: your email / Slack webhook

**SSL Certificate Monitoring:**
- UptimeRobot also monitors SSL expiry
- Set alert when certificate expires in < 14 days

**Azure Monitor (built-in):**
- VM CPU/memory metrics: Azure Portal → VM → Metrics
- PostgreSQL performance: Azure Portal → PostgreSQL → Monitoring
- Blob Storage: Azure Portal → Storage → Monitoring

### Log Aggregation (Optional)

For production-grade log management:
```bash
# Install Filebeat or Fluent Bit for centralized log shipping
# Destination: Azure Log Analytics, Elastic Cloud, or Datadog
```

### Sentry Error Tracking (Recommended)

1. Create a project at https://sentry.io
2. Add Django SDK:
   ```python
   # In backend/config/settings/base.py (already configured if SENTRY_DSN is set)
   import sentry_sdk
   if SENTRY_DSN := env("SENTRY_DSN", default=""):
       sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1)
   ```
3. Set `SENTRY_DSN` in `/etc/app/env`
4. Restart Gunicorn

---

## 16. Security Hardening

### SSH Hardening

```bash
sudo nano /etc/ssh/sshd_config
```

Set:
```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
AllowUsers aclp azureuser
```

```bash
sudo systemctl restart sshd
```

### fail2ban Configuration

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
maxretry = 3
```

```bash
sudo systemctl enable --now fail2ban
```

### OS Unattended Security Updates

```bash
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### File Permissions Audit

```bash
# Secrets file: owner aclp, mode 0640
ls -la /etc/app/env
# Expected: -rw-r----- 1 aclp aclp

# App directory: owned by aclp
ls -la /srv/aclp/
# Expected: drwxr-xr-x 4 aclp aclp

# Log directory: writable by aclp
ls -la /var/log/aclp/
# Expected: drwxr-xr-x 2 aclp aclp
```

---

## 17. Open Issues Before Go-Live

The following known gaps should be addressed before production launch:

| # | Issue | Priority | Fix |
| - | ----- | -------- | --- |
| 1 | `/dev/upload` and `/dev/download` are `AllowAny` | **HIGH** | Gate behind `DEBUG=True` check in URLs |
| 2 | No CI/CD pipeline | Medium | Create GitHub Actions workflow |
| 3 | Sentry not wired in frontend | Medium | Add `@sentry/react` SDK |
| 4 | `SECURE_PROXY_SSL_HEADER` not set in `production.py` | Medium | Add `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` |

> Item 1 is the remaining security issue that must be fixed before handling real user data.

---

## 18. Restoring from Database Dump

The deployment package includes `aclp_data.dump` — a PostgreSQL binary dump containing all live data:
- **1 Super Admin**, **4 Instructors**, **1130 Participants** across **25 Batches**
- All groups, memberships, instructor assignments, and system settings

### What you need

- `pg_restore` tool installed on your machine (comes with any PostgreSQL client installation)
  - **Ubuntu/Debian:** `sudo apt install postgresql-client`
  - **macOS:** `brew install postgresql`
  - **Windows:** Download from https://www.postgresql.org/download/windows/ (install "Command Line Tools")
- Your database connection details (from Section 3.2 and 6)

### Step 1 — Verify your database connection

Before restoring, confirm you can connect to the target database:

```bash
PGPASSWORD=<aclp_user-password> psql \
  -h <flex-server>.postgres.database.azure.com \
  -U aclp_user \
  -d aclp \
  -c "SELECT current_database(), version();"
```

Expected output: shows `aclp` as the database name and PostgreSQL version.

### Step 2 — Run Django migrations first

The dump includes data only for tables that exist. Run migrations before restoring to ensure all tables are present:

```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py migrate --noinput
'
```

### Step 3 — Restore the dump

Copy `aclp_data.dump` to the server, then run:

```bash
# Copy dump to server (run from your local machine)
scp aclp_data.dump azureuser@<VM-PUBLIC-IP>:/tmp/aclp_data.dump

# On the server — restore into the database
PGPASSWORD=<aclp_user-password> pg_restore \
  -h <flex-server>.postgres.database.azure.com \
  -U aclp_user \
  -d aclp \
  --no-owner \
  --role=aclp_user \
  --no-acl \
  -v \
  /tmp/aclp_data.dump
```

> The `-v` flag prints each restored table so you can see progress. This takes about 30–60 seconds for the full dataset.

> Ignore any `ERROR: role "ems_user" does not exist` warnings — these are ownership notices from the dev environment and do not affect the data.

### Step 4 — Verify the restore

```bash
PGPASSWORD=<aclp_user-password> psql \
  -h <flex-server>.postgres.database.azure.com \
  -U aclp_user \
  -d aclp \
  -c "SELECT role, COUNT(*) FROM accounts_user GROUP BY role ORDER BY role;"
```

Expected output:
```
    role     | count
-------------+-------
 ADMIN       |     1
 INSTRUCTOR  |     4
 PARTICIPANT |  1130
```

Also verify groups:
```bash
PGPASSWORD=<aclp_user-password> psql \
  -h <flex-server>.postgres.database.azure.com \
  -U aclp_user \
  -d aclp \
  -c "SELECT COUNT(*) AS groups FROM groups_classgroup;"
```

Expected: `25`

### Step 5 — Login and verify

Start all services (`sudo systemctl start aclp-gunicorn aclp-worker aclp-beat`) and log in:

| Role        | Email                    | Password    |
| ----------- | ------------------------ | ----------- |
| Super Admin | super.admin@adani.com    | password123 |
| Instructor  | divyansh.jha@adani.com   | admin123    |
| Participant | aagam.dosaliya@adani.com | admin123    |

> All Instructor and Participant accounts have `must_change_password = True`. A non-dismissible password-change dialog will appear on first login — this is expected behaviour.

### Troubleshooting restore errors

| Error | Cause | Fix |
| ----- | ----- | --- |
| `connection refused` | DB server unreachable | Check firewall, `DATABASE_URL`, VM IP allowlist in Azure |
| `role "ems_user" does not exist` | Dev ownership reference | Safe to ignore — use `--no-owner` flag (already included) |
| `relation already exists` | Table exists from migration | Add `--clean` flag to drop tables before restore |
| `pg_restore: command not found` | PostgreSQL client not installed | `sudo apt install postgresql-client` |

---

## 19. Setting Up the Database on Another Laptop (Local Dev)

Use this section if you want to run the full project locally on a new machine using the included `aclp_data.dump`.

### Step 1 — Install PostgreSQL

**Windows:**
Download and install from https://www.postgresql.org/download/windows/
During install, set a password for the `postgres` superuser — note it down.

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install postgresql postgresql-client
sudo systemctl start postgresql
```

### Step 2 — Create the database and user

Open a PostgreSQL shell:

**Windows:** Open "SQL Shell (psql)" from Start Menu  
**macOS/Linux:**
```bash
sudo -u postgres psql
```

Run these SQL commands:
```sql
CREATE DATABASE ems_db;
CREATE USER ems_user WITH PASSWORD 'ems_pass';
GRANT ALL PRIVILEGES ON DATABASE ems_db TO ems_user;
ALTER DATABASE ems_db OWNER TO ems_user;
\q
```

### Step 3 — Restore the dump

```bash
# Windows (run in Command Prompt or PowerShell)
set PGPASSWORD=ems_pass
pg_restore -h localhost -p 5432 -U ems_user -d ems_db --no-owner --no-acl -v aclp_data.dump

# macOS / Linux
PGPASSWORD=ems_pass pg_restore -h localhost -p 5432 -U ems_user -d ems_db --no-owner --no-acl -v aclp_data.dump
```

> Ignore any `role "ems_user" does not exist` warnings — they are harmless.

### Step 4 — Configure the backend

In the `backend/` folder, copy `.env.example` to `.env` and make sure these values match:

```dotenv
DATABASE_URL=postgres://ems_user:ems_pass@localhost:5432/ems_db
```

All other values in `.env.example` are already set for local development.

### Step 5 — Install backend dependencies and start

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py runserver
```

### Step 6 — Verify

Open `http://localhost:8000/api/v1/healthz` — you should see:
```json
{ "data": { "status": "ok", "db": "ok" } }
```

Then log in at `http://localhost:5173` (after starting the frontend):

| Role        | Email                    | Password    |
| ----------- | ------------------------ | ----------- |
| Super Admin | super.admin@adani.com    | password123 |
| Instructor  | divyansh.jha@adani.com   | admin123    |
| Participant | aagam.dosaliya@adani.com | admin123    |

### Alternative — Use Docker instead of installing PostgreSQL

If you prefer Docker:

```bash
# Start PostgreSQL container with the same credentials
docker run -d \
  --name aclp-db \
  -e POSTGRES_DB=ems_db \
  -e POSTGRES_USER=ems_user \
  -e POSTGRES_PASSWORD=ems_pass \
  -p 5432:5432 \
  postgres:15-alpine

# Restore the dump into the container
PGPASSWORD=ems_pass pg_restore \
  -h localhost -p 5432 \
  -U ems_user -d ems_db \
  --no-owner --no-acl -v \
  aclp_data.dump
```

Then continue from Step 4 above.

---

*Documentation version: 1.1 | Updated: 2026-06-07 | Source: Rutvik5o/EMS main branch*
