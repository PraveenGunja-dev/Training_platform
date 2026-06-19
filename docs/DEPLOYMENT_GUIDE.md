# Deployment Guide

**System:** ACLP Training Management System
**Target:** Azure VM (single host) — Standard_D2s_v3, Ubuntu 22.04
**External services:** Azure Database for PostgreSQL Flexible Server B2s · Azure Blob Storage · SMTP relay

---

## 1. Topology (single-VM production)

```
                          ┌─────────────────────────┐
   Internet ──443─▶ Nginx │  TLS terminator         │
                          │  • / (SPA dist)         │
                          │  • /api/v1/* (Gunicorn) │
                          │  • /admin/  (firewalled)│
                          └────────┬────────────────┘
                                   │  unix:/run/aclp.sock
                          ┌────────▼────────────────┐
                          │  Gunicorn (3 workers)   │
                          │  Django + DRF           │
                          └────────┬────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
    ┌───────▼───────┐    ┌─────────▼────────┐   ┌─────────▼─────────┐
    │ Postgres 15   │    │ Redis 7 (docker) │   │ Celery worker+beat │
    │ Azure Flex DB │    │ on VM            │   │ (systemd units)    │
    └───────────────┘    └──────────────────┘   └────────────────────┘
                                                          │
                                                ┌─────────▼─────────┐
                                                │  Azure Blob       │
                                                │  Storage (SAS)    │
                                                └───────────────────┘
```

## 2. Pre-flight Checklist

- [ ] Azure subscription with quota for B-series + DB Flex + Blob
- [ ] Domain pointing A-record to VM public IP
- [ ] Azure Blob storage account created; container `aclp-prod` created
- [ ] Azure Postgres Flexible Server provisioned; firewall allows VM IP
- [ ] SMTP credentials (Microsoft 365 or SendGrid)
- [ ] GitHub access for `Rutvik5o/EMS`
- [ ] Random 64-char `SECRET_KEY` generated
- [ ] (Recommended) Sentry project created

## 3. VM Bootstrap (one-time)

```bash
# 3.1 OS prep
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx git python3.11 python3.11-venv python3-pip \
                    build-essential libpq-dev ca-certificates curl \
                    ufw fail2ban

# 3.2 Node.js 20 (for frontend build) — optional if building on CI
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs

# 3.3 Docker (for local Redis)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 3.4 Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 3.5 App user
sudo adduser --disabled-password --gecos "" aclp
sudo mkdir -p /srv/aclp /etc/app /var/log/aclp
sudo chown -R aclp:aclp /srv/aclp /var/log/aclp
sudo chmod 750 /etc/app
```

## 4. Application Layout on Disk

```
/srv/aclp/
├── app/                        # git clone
│   ├── backend/
│   ├── frontend/
│   └── dist/                   # built SPA (symlink → frontend/dist)
├── venv/                       # python virtualenv
└── media/                      # photos (when DEV_LOCAL_STORAGE)

/etc/app/env                    # secrets (mode 0640, owner aclp:aclp)
/etc/systemd/system/
├── aclp-gunicorn.service
├── aclp-worker.service
└── aclp-beat.service
/etc/nginx/sites-available/aclp.conf
/var/log/aclp/{access,error}.log
```

## 5. Environment File (`/etc/app/env`)

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<64-char random>
DEBUG=False
ALLOWED_HOSTS=aclp.adani.example.com
CORS_ALLOWED_ORIGINS=https://aclp.adani.example.com
FRONTEND_URL=https://aclp.adani.example.com

DATABASE_URL=postgres://aclp_user:<pwd>@<flex>.postgres.database.azure.com:5432/aclp?sslmode=require
REDIS_URL=redis://localhost:6379/0

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@adani.com
EMAIL_HOST_PASSWORD=<app-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=ACLP <noreply@adani.com>

AZURE_ACCOUNT_NAME=aclpprod
AZURE_ACCOUNT_KEY=<key>
AZURE_CONTAINER=aclp-prod
DEV_LOCAL_STORAGE=False

SENTRY_DSN=https://<key>@sentry.io/<project>
```

Set permissions: `sudo chown aclp:aclp /etc/app/env && sudo chmod 0640 /etc/app/env`.

## 6. Code Deployment

```bash
# 6.1 Clone
sudo -u aclp -H bash -c '
  cd /srv/aclp
  git clone https://github.com/Rutvik5o/EMS.git app
  python3.11 -m venv venv
  source venv/bin/activate
  pip install -U pip
  pip install -r app/backend/requirements.txt
'

# 6.2 DB migrate + collectstatic + seed (initial)
sudo -u aclp -H bash -c '
  cd /srv/aclp/app/backend
  source ../../venv/bin/activate
  set -a && source /etc/app/env && set +a
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
  python manage.py seed_demo   # OPTIONAL: only on first deploy if demo data desired
'

# 6.3 Frontend build (on VM or CI)
sudo -u aclp -H bash -c '
  cd /srv/aclp/app/frontend
  echo "VITE_API_BASE_URL=https://aclp.adani.example.com/api/v1
VITE_APP_NAME=ACLP Training Management System
VITE_MOCK_API=false" > .env
  npm ci
  npm run build
'
```

## 7. systemd Units

### 7.1 `/etc/systemd/system/aclp-gunicorn.service`
```ini
[Unit]
Description=ACLP Gunicorn
After=network.target

[Service]
User=aclp
Group=aclp
EnvironmentFile=/etc/app/env
WorkingDirectory=/srv/aclp/app/backend
ExecStart=/srv/aclp/venv/bin/gunicorn config.wsgi:application \
  --workers 3 --bind unix:/run/aclp.sock --access-logfile /var/log/aclp/access.log \
  --error-logfile /var/log/aclp/error.log
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 7.2 `/etc/systemd/system/aclp-worker.service`
```ini
[Unit]
Description=ACLP Celery worker
After=network.target

[Service]
User=aclp
Group=aclp
EnvironmentFile=/etc/app/env
WorkingDirectory=/srv/aclp/app/backend
ExecStart=/srv/aclp/venv/bin/celery -A config worker -l info --concurrency=2
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 7.3 `/etc/systemd/system/aclp-beat.service`
```ini
[Unit]
Description=ACLP Celery beat
After=network.target

[Service]
User=aclp
Group=aclp
EnvironmentFile=/etc/app/env
WorkingDirectory=/srv/aclp/app/backend
ExecStart=/srv/aclp/venv/bin/celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aclp-gunicorn aclp-worker aclp-beat
sudo docker run -d --restart=always --name redis -p 127.0.0.1:6379:6379 redis:7
```

## 8. Nginx (`/etc/nginx/sites-available/aclp.conf`)

```nginx
upstream aclp_app { server unix:/run/aclp.sock; }

server {
  listen 80;
  server_name aclp.adani.example.com;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl http2;
  server_name aclp.adani.example.com;

  ssl_certificate     /etc/letsencrypt/live/aclp.adani.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/aclp.adani.example.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https://*.blob.core.windows.net; connect-src 'self' https://*.blob.core.windows.net; style-src 'self' 'unsafe-inline'; script-src 'self'" always;

  client_max_body_size 600M;  # video uploads pass via SAS, but keep headroom

  # Recommended rate limit (open issue — currently absent)
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

  root /srv/aclp/app/frontend/dist;
  index index.html;

  location /api/ {
    proxy_pass http://aclp_app;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 120s;
  }

  location = /api/v1/auth/login   { limit_req zone=login burst=5 nodelay; proxy_pass http://aclp_app; include /etc/nginx/proxy_params; }
  location = /api/v1/auth/forgot-password { limit_req zone=login burst=2 nodelay; proxy_pass http://aclp_app; include /etc/nginx/proxy_params; }

  location / { try_files $uri /index.html; }

  location /static/ { alias /srv/aclp/app/backend/staticfiles/; expires 7d; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/aclp.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d aclp.adani.example.com --redirect --hsts --staple-ocsp
```

## 9. Health Checks & Smoke Tests

```bash
curl -fsS https://aclp.adani.example.com/api/v1/healthz | jq
# Expected: { "data": { "status": "ok", "db": "ok", "redis": "ok", "scheduler": { "last_heartbeat_at": "..." } } }
```

End-to-end:
1. Open https://… → login screen
2. Login as seeded admin → `/admin/dashboard` 200
3. Create a class → check Notification fires
4. Open Swagger UI at `/api/docs/` (firewall as needed)

## 10. Backups & DR

| Asset | Mechanism | Frequency | RTO / RPO |
|---|---|---|---|
| Postgres | Azure Flex Server PITR (built-in) | Continuous (5-min log) | RTO 30 min · RPO 5 min |
| Blob storage | Soft delete (14 d) + GRS | Continuous | RTO 1 h · RPO 0 |
| `/etc/app/env` | Manual copy to KeyVault | Per change | — |
| Application code | GitHub | Per commit | — |

## 11. Routine Operations

| Operation | Command |
|---|---|
| Deploy new release | `cd /srv/aclp/app && sudo -u aclp git pull && sudo -u aclp /srv/aclp/venv/bin/python backend/manage.py migrate && sudo -u aclp /srv/aclp/venv/bin/python backend/manage.py collectstatic --noinput && cd frontend && sudo -u aclp npm ci && sudo -u aclp npm run build && sudo systemctl restart aclp-gunicorn aclp-worker aclp-beat` |
| Restart app | `sudo systemctl restart aclp-gunicorn` |
| Tail logs | `sudo journalctl -u aclp-gunicorn -f` |
| Restart Celery | `sudo systemctl restart aclp-worker aclp-beat` |
| Force-logout all | `POST /api/v1/admin/settings/force-logout` from Settings UI |
| Backup snapshot (manual) | `pg_dump $DATABASE_URL > /var/backups/aclp-$(date +%F).sql` |

## 12. Rollback

1. `git -C /srv/aclp/app checkout <previous-sha>`
2. Re-run `migrate` (Django migrations are forward-only; restore DB from PITR if migration must be reverted)
3. Rebuild frontend
4. `systemctl restart aclp-*`

## 13. Open Gaps Before Go-Live

- [ ] Rate limiting on `/auth/refresh`, `/me/password`, `/auth/forgot-password` (see SECURITY_AUDIT.md #2)
- [ ] Forgot-password token persistence fix (#1)
- [ ] Set `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` in `production.py`
- [ ] Disable `/dev/upload` and `/dev/download` from URLConf when `DEBUG=False`
- [ ] Configure Sentry SDK in Django + frontend
- [ ] Document RTO/RPO acceptance with stakeholders

---
*Generated 2026-05-28; verify against current source before applying.*
