# ACLP Training Management System — Deployment Checklist

Complete deployment checklist for a deployment engineer with no prior project knowledge. Work through each section in order.

---

## Phase 1: Pre-Deployment Preparation

### 1.1 Azure Resource Preparation
- [ ] Azure subscription active and accessible
- [ ] Region selected (choose the region closest to your users)
- [ ] Azure VM created (Standard_D2s_v3, Ubuntu 22.04 LTS)
- [ ] VM static public IP address assigned
- [ ] Azure PostgreSQL Flexible Server created (B2s, PostgreSQL 15)
- [ ] PostgreSQL SSL enforcement enabled
- [ ] PostgreSQL firewall rule added for VM's private IP
- [ ] Application database created (`aclp`)
- [ ] Application database user created (`aclp_user` with full privileges)
- [ ] Azure Blob Storage account created (Standard LRS)
- [ ] Blob container created (`aclp-prod`, Private access level)
- [ ] Blob soft delete enabled (14-day retention)
- [ ] Storage account key copied and stored securely

### 1.2 Domain & DNS
- [ ] Domain name registered or available
- [ ] DNS A record created: `yourdomain.com` → VM public IP
- [ ] DNS A record created: `www.yourdomain.com` → VM public IP (optional)
- [ ] DNS propagation verified: `nslookup yourdomain.com` returns VM IP

### 1.3 Email Setup
- [ ] SMTP credentials obtained from email provider
- [ ] SMTP authentication tested (send a test email manually)
- [ ] App-specific password created (not account password) for M365/Gmail

### 1.4 Credentials Gathered
- [ ] `SECRET_KEY` generated (64+ chars): `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`
- [ ] Database username and password noted
- [ ] Azure storage account name and key noted
- [ ] SMTP host, port, user, and password noted
- [ ] (Optional) Sentry DSN obtained

### 1.5 Access Verification
- [ ] SSH access to VM working: `ssh azureuser@<VM-IP>`
- [ ] GitHub repository accessible: `https://github.com/Rutvik5o/EMS`
- [ ] Azure Portal accessible with sufficient permissions

---

## Phase 2: VM Bootstrap

### 2.1 OS Preparation
- [ ] `sudo apt update && sudo apt -y upgrade` completed
- [ ] Required packages installed:
  ```
  nginx git python3.11 python3.11-venv python3-pip
  build-essential libpq-dev ca-certificates curl ufw fail2ban
  ```
- [ ] Node.js 20.x installed via NodeSource: `node --version` shows `v20.x.x`
- [ ] Docker installed and running: `docker ps` works
- [ ] Redis container started: `docker run -d --name redis --restart=always -p 127.0.0.1:6379:6379 redis:7-alpine`
- [ ] Redis responds: `redis-cli ping` → `PONG`

### 2.2 Firewall
- [ ] UFW enabled: `sudo ufw status` shows `Status: active`
- [ ] OpenSSH allowed
- [ ] Nginx Full (80 + 443) allowed
- [ ] Other ports blocked by default

### 2.3 Application User
- [ ] `aclp` user created: `sudo adduser --disabled-password --gecos "" aclp`
- [ ] Directories created: `/srv/aclp`, `/etc/app`, `/var/log/aclp`
- [ ] Ownership set: `aclp:aclp` on `/srv/aclp` and `/var/log/aclp`

---

## Phase 3: Environment Configuration

### 3.1 Secrets File
- [ ] `/etc/app/env` file created
- [ ] All required variables populated (see list below)
- [ ] Permissions set: `chown aclp:aclp /etc/app/env && chmod 0640 /etc/app/env`
- [ ] `ls -la /etc/app/env` shows `-rw-r----- 1 aclp aclp`

**Variables populated in `/etc/app/env`:**
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.production`
- [ ] `SECRET_KEY=<64-char-key>`
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS=yourdomain.com`
- [ ] `CORS_ALLOWED_ORIGINS=https://yourdomain.com`
- [ ] `FRONTEND_URL=https://yourdomain.com`
- [ ] `DATABASE_URL=postgres://...` (with `sslmode=require`)
- [ ] `REDIS_URL=redis://127.0.0.1:6379/0`
- [ ] `CELERY_BROKER_URL=redis://127.0.0.1:6379/0`
- [ ] `CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1`
- [ ] `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
- [ ] `EMAIL_HOST=<smtp-server>`
- [ ] `EMAIL_PORT=587`
- [ ] `EMAIL_HOST_USER=<email>`
- [ ] `EMAIL_HOST_PASSWORD=<password>`
- [ ] `EMAIL_USE_TLS=True`
- [ ] `DEFAULT_FROM_EMAIL=<display-name> <email>`
- [ ] `AZURE_ACCOUNT_NAME=<name>`
- [ ] `AZURE_ACCOUNT_KEY=<key>`
- [ ] `AZURE_CONTAINER=aclp-prod`
- [ ] `DEV_LOCAL_STORAGE=False`
- [ ] `INSTRUCTOR_ROLE_ENABLED=True`

---

## Phase 4: Application Deployment

### 4.1 Repository Clone
- [ ] Repository cloned: `sudo -u aclp git clone https://github.com/Rutvik5o/EMS.git /srv/aclp/app`
- [ ] Correct branch/tag checked out (usually `main`)

### 4.2 Python Environment
- [ ] Virtual environment created: `/srv/aclp/venv`
- [ ] Dependencies installed: `pip install -r app/backend/requirements.txt`
- [ ] No errors during `pip install`

### 4.3 Database Setup
- [ ] `python manage.py migrate --noinput` completed with no errors
- [ ] (Optional) Restore data from dump: `pg_restore -h <server> -U aclp_user -d aclp --no-owner aclp_data.dump`
- [ ] `python manage.py collectstatic --noinput` completed
- [ ] Static files are in `/srv/aclp/app/backend/staticfiles/`

### 4.4 Frontend Build
- [ ] `/srv/aclp/app/frontend/.env` created with correct production values
- [ ] `npm ci` completed with no errors
- [ ] `npm run build` completed with no errors
- [ ] `frontend/dist/` directory contains `index.html` and `assets/` folder

---

## Phase 5: systemd Services

### 5.1 Service Files Created
- [ ] `/etc/systemd/system/aclp-gunicorn.service` created
- [ ] `/etc/systemd/system/aclp-worker.service` created
- [ ] `/etc/systemd/system/aclp-beat.service` created

### 5.2 Services Enabled & Running
- [ ] `sudo systemctl daemon-reload` executed
- [ ] `sudo systemctl enable aclp-gunicorn aclp-worker aclp-beat`
- [ ] `sudo systemctl start aclp-gunicorn aclp-worker aclp-beat`
- [ ] All three show `Active: active (running)`:
  - [ ] `sudo systemctl status aclp-gunicorn`
  - [ ] `sudo systemctl status aclp-worker`
  - [ ] `sudo systemctl status aclp-beat`

---

## Phase 6: Nginx & SSL

### 6.1 Nginx Configuration
- [ ] `/etc/nginx/sites-available/aclp.conf` created
- [ ] Domain name substituted correctly (no placeholder text remaining)
- [ ] Site enabled: `sudo ln -s /etc/nginx/sites-available/aclp.conf /etc/nginx/sites-enabled/`
- [ ] Nginx test passes: `sudo nginx -t` → `syntax is ok`
- [ ] Nginx reloaded: `sudo systemctl reload nginx`

### 6.2 SSL Certificate
- [ ] Certbot installed: `certbot --version`
- [ ] Certificate issued: `sudo certbot --nginx -d yourdomain.com`
- [ ] Certificate auto-renewal timer active: `sudo systemctl status certbot.timer`
- [ ] Dry run passes: `sudo certbot renew --dry-run`
- [ ] HTTPS redirect works: `curl -I http://yourdomain.com` → `301 Moved Permanently` to HTTPS

---

## Phase 7: Verification

### 7.1 Infrastructure Checks
- [ ] `curl -fsS https://yourdomain.com/api/v1/healthz` returns 200
- [ ] Health response shows `"status": "ok"`, `"db": "ok"`, `"redis": "ok"`
- [ ] Celery heartbeat is recent (within 2 minutes)
- [ ] `https://yourdomain.com` redirects to HTTPS (not HTTP)
- [ ] SSL certificate valid: `https://yourdomain.com` shows padlock

### 7.2 Application Smoke Tests
- [ ] Login page loads at `https://yourdomain.com`
- [ ] Admin login works with seeded credentials (if seed_demo was run)
- [ ] Admin dashboard loads with data
- [ ] Create a test class → class appears on calendar
- [ ] Add a test participant to a group → `GROUP_ADDED` notification received
- [ ] Start an attendance session → participant can see the mark button
- [ ] Upload a test document → it appears in the document library
- [ ] Participant can see their tasks
- [ ] Force-change-password dialog appears on first login with default password
- [ ] Login with kiran.kr@adani.com / admin123 → force-change dialog shown

### 7.3 Email Verification
- [ ] Confirm EMAIL_BACKEND is set to smtp.EmailBackend (NOT dummy.EmailBackend)
- [ ] Send a test invite to verify email delivery works
- [ ] Invite email received with correct link (starts with https://yourdomain.com)

### 7.4 File Upload Verification
- [ ] Admin creates an assignment with a question file → file uploads successfully
- [ ] Participant can download the question file
- [ ] Participant can submit an assignment file

### 7.5 Security Checks
- [ ] `/api/docs/` loads Swagger UI (consider restricting in future)
- [ ] `http://yourdomain.com` redirects to `https://` (not bypassed)
- [ ] Response headers include `Strict-Transport-Security`
- [ ] `/etc/app/env` permissions are `0640` (not world-readable)

---

## Phase 8: Monitoring Setup

### 8.1 Uptime Monitoring
- [ ] UptimeRobot (or equivalent) monitor created for `https://yourdomain.com/api/v1/healthz`
- [ ] Monitoring interval: 5 minutes
- [ ] Alert email/Slack webhook configured
- [ ] SSL expiry alert configured (warn at 14 days before expiry)

### 8.2 Azure Monitoring
- [ ] Azure PostgreSQL monitoring enabled (CPU, storage, connections)
- [ ] Azure VM alerts configured (CPU > 90% for 5 min)
- [ ] Azure Blob Storage monitoring enabled

### 8.3 Log Rotation
- [ ] `/etc/logrotate.d/aclp` configured for `/var/log/aclp/*.log`
  ```
  /var/log/aclp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
      systemctl reload aclp-gunicorn
    endscript
  }
  ```

### 8.4 Error Tracking (Optional)
- [ ] `SENTRY_DSN` set in `/etc/app/env`
- [ ] Test error received in Sentry dashboard (trigger via `python manage.py shell -c "raise Exception('test')"`)

---

## Phase 9: Backup Verification

### 9.1 Database Backups
- [ ] Azure PostgreSQL PITR enabled (confirm in Azure Portal)
- [ ] Backup retention period set to 7+ days
- [ ] PITR restore tested to a separate server (confirm backup is recoverable)

### 9.2 File Storage Backups
- [ ] Blob Storage soft delete enabled (14-day retention)
- [ ] (Optional) GRS replication enabled for Blob Storage

### 9.3 Secrets Backup
- [ ] `/etc/app/env` backed up to Azure Key Vault or secure location
- [ ] Access to backup verified by a second team member

---

## Phase 10: Security Review

### 10.1 Known Issues to Address
- [x] ~~Forgot-password feature~~ — **REMOVED** (not needed)
- [x] ~~Rate limiting on /auth/refresh and /me/password~~ — **FIXED** (DRF throttling applied)
- [x] ~~SetPasswordSerializer skips validate_password()~~ — **FIXED**
- [ ] **HIGH:** `/dev/upload` and `/dev/download` endpoints must be inaccessible (DEBUG=False gates them automatically)
- [ ] **MEDIUM:** `SECURE_PROXY_SSL_HEADER` added to `production.py`

### 10.2 Hardening Checks
- [ ] SSH password authentication disabled
- [ ] Root login via SSH disabled
- [ ] fail2ban active for SSH
- [ ] UFW blocking all ports except 22, 80, 443
- [ ] Django `--deploy` check passes with no issues: `python manage.py check --deploy`

---

## Sign-Off

| Task | Completed By | Date | Notes |
| ---- | ------------ | ---- | ----- |
| Phase 1: Pre-Deployment | | | |
| Phase 2: VM Bootstrap | | | |
| Phase 3: Environment Config | | | |
| Phase 4: Application Deployment | | | |
| Phase 5: systemd Services | | | |
| Phase 6: Nginx & SSL | | | |
| Phase 7: Verification | | | |
| Phase 8: Monitoring | | | |
| Phase 9: Backups | | | |
| Phase 10: Security | | | |
| **Production Go-Live Approved** | | | |

---

## Rollback Plan

If the deployment fails at any phase:

1. **Phases 1-5 (before Nginx):** No user traffic affected. Fix the issue and retry.
2. **Phases 6-7 (after Nginx):** If site is up but broken, use git rollback (see `DEPLOYMENT_GUIDE.md §14`).
3. **Database corruption:** Restore from Azure PITR (30-min RTO, 5-min RPO).
4. **Complete failure:** Terminate VM, restore to last snapshot (if VM backup enabled), or provision fresh from scratch using this checklist.
