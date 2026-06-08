# ACLP Training Management System — Production Troubleshooting Guide

Troubleshooting guide for the production Azure VM deployment. Written for operators who may not be familiar with the project's codebase.

---

## Quick Diagnostics

Run these commands first when something goes wrong:

```bash
# 1. Check if all services are running
sudo systemctl status aclp-gunicorn aclp-worker aclp-beat

# 2. Check health endpoint
curl -fsS http://localhost:8001/api/v1/healthz 2>/dev/null || \
curl -fsS https://yourdomain.com/api/v1/healthz

# 3. Check Nginx
sudo nginx -t
sudo systemctl status nginx

# 4. Check Redis
redis-cli ping   # Should return PONG

# 5. Check recent errors
sudo journalctl -u aclp-gunicorn -n 50 --no-pager
```

---

## Service Status Diagnostics

### All Services Down

**Symptom:** Site completely unreachable.

```bash
# Check each service
sudo systemctl status nginx
sudo systemctl status aclp-gunicorn
sudo systemctl status aclp-worker
sudo systemctl status aclp-beat

# Restart all
sudo systemctl restart nginx aclp-gunicorn aclp-worker aclp-beat
```

### Gunicorn Not Starting

**Symptom:** `502 Bad Gateway` from Nginx.

```bash
# See exact error
sudo journalctl -u aclp-gunicorn -n 100 --no-pager

# Check socket file exists
ls -la /run/aclp.sock

# Manual start (to see errors directly)
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  /srv/aclp/venv/bin/gunicorn config.wsgi:application --bind 0.0.0.0:8001 --workers 1
'
```

**Common causes:**
- Bad environment variable in `/etc/app/env` (syntax error, missing value)
- Python dependency missing (run `pip install -r requirements.txt`)
- Database unreachable (check `DATABASE_URL` and PostgreSQL firewall)
- Import error in Django code

---

## HTTP Error Troubleshooting

### 502 Bad Gateway

**Cause:** Nginx can't reach Gunicorn.

```bash
# Is Gunicorn running?
sudo systemctl status aclp-gunicorn

# Does the socket exist?
ls -la /run/aclp.sock

# Fix
sudo systemctl restart aclp-gunicorn
```

### 503 Service Unavailable

**Cause:** All Gunicorn workers are busy (overloaded).

**Short-term fix:** Restart Gunicorn.
```bash
sudo systemctl restart aclp-gunicorn
```

**Long-term fix:** Increase worker count in the service file:
```ini
ExecStart=/srv/aclp/venv/bin/gunicorn config.wsgi:application \
  --workers 5 \    # Increase from 3
  ...
```

### 500 Internal Server Error

**Cause:** Django threw an unhandled exception.

```bash
# See the error
sudo journalctl -u aclp-gunicorn -n 100 --no-pager | grep -A 20 "ERROR\|Traceback"
sudo tail -n 100 /var/log/aclp/error.log
```

### 403 Forbidden (from Django)

**Cause:** CSRF token missing or CORS mismatch.

**Check:**
- `CORS_ALLOWED_ORIGINS` in `/etc/app/env` matches the frontend URL exactly
- Nginx is passing `X-Forwarded-Proto https` header

### 404 Not Found on all `/api/` routes

**Cause:** Nginx proxy not configured or Gunicorn not running.

```bash
sudo nginx -t
sudo systemctl status aclp-gunicorn
```

---

## Database Issues

### Cannot Connect to PostgreSQL

**Error in logs:** `connection refused` or `could not connect to server`

**Check:**
```bash
# Test the connection from VM
psql "postgres://aclp_user:<password>@<server>.postgres.database.azure.com:5432/aclp?sslmode=require" -c "SELECT 1;"
```

**Common causes:**
- PostgreSQL Flexible Server firewall doesn't allow VM's IP
  - Fix: Azure Portal → PostgreSQL → Networking → Add current IP
- Wrong password in `DATABASE_URL`
- PostgreSQL server is paused (Azure auto-pause on B-tier)
  - Fix: Azure Portal → PostgreSQL → Overview → Resume

### Migration Errors on Deploy

**Error:** `django.db.utils.ProgrammingError: column does not exist`

**Fix:**
```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py migrate --noinput
'
```

### Database Full

**Check disk usage:**
- Azure Portal → PostgreSQL → Monitoring → Storage

**Fix:**
- Increase storage in Azure Portal
- Delete old audit log entries (if acceptable — note: audit log is append-only by design)
- Archive old `DashboardSnapshot` records

---

## Redis Issues

### Redis Not Running

**Symptom:** Celery tasks fail; health endpoint shows `"redis": "error"`.

```bash
# Check if Redis container is running
docker ps | grep redis

# If not running, start it
docker start redis

# If container doesn't exist, recreate it
docker run -d \
  --name redis \
  --restart=always \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine

# Verify
redis-cli ping   # → PONG
```

### Redis Memory Full

**Symptom:** `OOM command not allowed when used memory > 'maxmemory'` in logs.

**Fix:**
```bash
# Check memory usage
redis-cli info memory | grep used_memory_human

# Flush expired keys (safe)
redis-cli --scan --pattern '*' | head -100

# Or restart Redis (clears all data — users will be logged out)
docker restart redis
```

---

## Celery Issues

### Background Tasks Not Running

**Symptom:** Emails not sending, tasks not completing, health endpoint shows stale heartbeat.

```bash
# Check Celery worker status
sudo systemctl status aclp-worker
sudo journalctl -u aclp-worker -n 50

# Check Celery beat (scheduler)
sudo systemctl status aclp-beat
sudo journalctl -u aclp-beat -n 50

# Restart both
sudo systemctl restart aclp-worker aclp-beat
```

### Celery Beat Not Scheduling Tasks

**Symptom:** Reminders not sending, tasks not auto-opening.

**Check heartbeat timestamp:**
```bash
curl -fsS https://yourdomain.com/api/v1/healthz | python3 -m json.tool
# Look at scheduler.last_heartbeat_at
```

If `last_heartbeat_at` is more than 2 minutes old, Celery beat is not running.

```bash
sudo systemctl restart aclp-beat
```

---

## File Upload Issues

### Azure Blob Upload Fails

**Symptom:** Users get errors when uploading assignment files, submissions, or documents.

**Test the connection:**
```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py shell -c "
from azure.storage.blob import BlobServiceClient
import os
client = BlobServiceClient(
  account_url=f\"https://{os.environ[\"AZURE_ACCOUNT_NAME\"]}.blob.core.windows.net\",
  credential=os.environ[\"AZURE_ACCOUNT_KEY\"]
)
props = client.get_account_information()
print(\"Connected:\", props)
"
'
```

**Common causes:**
- `AZURE_ACCOUNT_KEY` is wrong or has been rotated
  - Fix: Get new key from Azure Portal → Storage Account → Access Keys
- Container `aclp-prod` doesn't exist
  - Fix: Create the container in Azure Portal
- Network security group blocking outbound HTTPS to Azure

### SAS URL Expired

**Cause:** SAS tokens are valid for 15 minutes. Old/cached SAS URLs fail.

**This is expected behavior.** The frontend should request a new SAS URL for each upload. If users are consistently getting expired URL errors, check the clock synchronization on the VM:

```bash
timedatectl status
# Check that NTP sync is active
```

---

## Email Issues

### Emails Not Sending

**Check SMTP connectivity:**
```bash
# Test SMTP connection from VM
python3 -c "
import smtplib
server = smtplib.SMTP('smtp.office365.com', 587)
server.ehlo()
server.starttls()
server.login('noreply@yourdomain.com', 'your-password')
server.quit()
print('SMTP connection successful')
"
```

**Test via Django:**
```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py shell -c "
from django.core.mail import send_mail
result = send_mail(\"Test\", \"Test body\", None, [\"admin@yourdomain.com\"])
print(\"Emails sent:\", result)
"
'
```

**Common causes:**
- Port 587 blocked outbound by VM's network security group
- SMTP AUTH not enabled on the mailbox
- App password not generated (account password won't work)

---

## SSL Certificate Issues

### Certificate Expired

```bash
# Check certificate expiry
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Renew certificate
sudo certbot renew

# Reload Nginx to use new certificate
sudo systemctl reload nginx
```

### Certificate Renewal Fails

```bash
# Run in verbose mode to see error
sudo certbot renew --verbose

# Common fix: ensure port 80 is open and Nginx is running
sudo systemctl status nginx
sudo ufw status
```

---

## Deployment Issues

### New Deployment Broke the App

**Quick rollback:**
```bash
# Find last working commit
git -C /srv/aclp/app log --oneline -10

# Rollback to previous version (if no new migration)
sudo -u aclp git -C /srv/aclp/app checkout <previous-sha>
sudo systemctl restart aclp-gunicorn aclp-worker aclp-beat
```

If a database migration was applied, see the [Rollback Procedure](DEPLOYMENT_GUIDE.md#14-rollback-procedure) for database restoration steps.

### Static Files Not Loading (CSS/JS Missing)

**Cause:** `collectstatic` was not run after deployment.

```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py collectstatic --noinput
'
sudo systemctl reload nginx
```

### Frontend Shows Old Version

**Cause:** Browser is caching old JS/CSS files.

This shouldn't happen if Vite's cache-busting filenames are working. To force users to reload:
- Nginx sends `Cache-Control` headers for static files
- Hard refresh: Ctrl+Shift+R

If the server is serving old files, the frontend wasn't rebuilt:
```bash
sudo -u aclp bash -c '
  cd /srv/aclp/app/frontend
  npm ci && npm run build
'
```

---

## Security Issues

### Suspicious Login Attempts

**Check fail2ban:**
```bash
sudo fail2ban-client status sshd
sudo fail2ban-client status nginx-http-auth
```

**Check Nginx access log:**
```bash
sudo tail -1000 /var/log/nginx/access.log | grep " 401 \| 403 " | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
```

### High Server Load

```bash
# Check CPU/memory
top -b -n1 | head -20

# Check which processes are using resources
ps aux --sort=-%cpu | head -20

# Check active database connections
sudo -u aclp bash -c '
  cd /srv/aclp/app/backend
  source /srv/aclp/venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute(\"SELECT count(*) FROM pg_stat_activity WHERE state = '\''active'\''\")
    print(\"Active DB connections:\", c.fetchone()[0])
"
'
```

---

## Log Locations Reference

| Log | Location | Access Command |
| --- | -------- | -------------- |
| Gunicorn access | `/var/log/aclp/access.log` | `tail -f /var/log/aclp/access.log` |
| Gunicorn errors | `/var/log/aclp/error.log` | `tail -f /var/log/aclp/error.log` |
| Celery worker | journald | `journalctl -u aclp-worker -f` |
| Celery beat | journald | `journalctl -u aclp-beat -f` |
| Nginx access | `/var/log/nginx/access.log` | `tail -f /var/log/nginx/access.log` |
| Nginx errors | `/var/log/nginx/error.log` | `tail -f /var/log/nginx/error.log` |
| System | journald | `journalctl -f` |
| fail2ban | `/var/log/fail2ban.log` | `tail -f /var/log/fail2ban.log` |

---

## Emergency Contacts & Resources

| Resource | URL / Command |
| -------- | ------------- |
| Swagger API docs | `https://yourdomain.com/api/docs/` |
| Health endpoint | `https://yourdomain.com/api/v1/healthz` |
| Django admin | `https://yourdomain.com/django-admin/` |
| GitHub repository | `https://github.com/Rutvik5o/EMS` |
| Azure Portal | `https://portal.azure.com` |

---

## Error Message Quick Reference

| Error message | Service | Fix |
| ------------- | ------- | --- |
| `502 Bad Gateway` | Nginx | Restart `aclp-gunicorn` |
| `connection refused` (Redis) | Celery/Django | Start Redis: `docker start redis` |
| `could not connect to server` | Django/Celery | Check PostgreSQL firewall and `DATABASE_URL` |
| `DISALLOWED_HOST` | Django | Add domain to `ALLOWED_HOSTS` in `/etc/app/env` |
| `certificate verify failed` | Anywhere | Check SSL cert: `sudo certbot renew` |
| `SMTPAuthenticationError` | Email | Use app password, enable SMTP AUTH |
| `SAS URL expired` | File upload | Request new upload URL (client-side refresh) |
| `health: scheduler stale` | Celery beat | Restart `aclp-beat` |
| `OOM command not allowed` | Redis | Redis memory full — restart Redis container |
