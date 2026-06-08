# ACLP Training Management System — Infrastructure Requirements

This document lists every requirement — hardware, software, accounts, and access — needed to deploy the system to production. Written for a deployment engineer with no prior project knowledge.

---

## Azure Cloud Requirements

### Required Azure Services

| Service                                       | SKU / Tier               | Quantity | Purpose                                        |
| --------------------------------------------- | ------------------------ | -------- | ---------------------------------------------- |
| Azure Virtual Machine                         | Standard_D2s_v3          | 1        | Application server (Django + Nginx + Celery)   |
| Azure Database for PostgreSQL Flexible Server | B2s (2 vCores, 4 GB RAM) | 1        | Primary database                               |
| Azure Blob Storage Account                    | Standard LRS             | 1        | File storage (uploads, documents, submissions) |
| Public IP Address (Static)                    | Standard SKU             | 1        | Fixed IP for DNS                               |
| Virtual Network (optional)                    | Standard                 | 1        | Network isolation (recommended)                |

### Azure Account Requirements

- Active Azure subscription with Owner or Contributor role
- Permission to create VMs, database servers, and storage accounts
- Sufficient quota for D2s_v3 in the target region (request increase if needed)
- Azure CLI installed on deployment workstation (`az login` authenticated)

---

## Virtual Machine Requirements

### Minimum Specifications

| Resource | Minimum          | Recommended        |
| -------- | ---------------- | ------------------ |
| vCPUs    | 2                | 4                  |
| RAM      | 8 GB             | 16 GB              |
| OS Disk  | 64 GB SSD        | 128 GB Premium SSD |
| OS       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS   |
| Network  | 1 Gbps           | 1 Gbps             |

### Required Software on VM

Install these packages before deploying the application:

| Software        | Version    | Install command                                        |
| --------------- | ---------- | ------------------------------------------------------ |
| Python          | 3.11       | `apt install python3.11 python3.11-venv python3-pip` |
| Node.js         | 20.x (LTS) | NodeSource setup script                                |
| Nginx           | 1.18+      | `apt install nginx`                                  |
| Docker          | 24+        | Official Docker install script                         |
| Certbot         | 2.x        | `apt install certbot python3-certbot-nginx`          |
| git             | 2.34+      | `apt install git`                                    |
| build-essential | latest     | `apt install build-essential`                        |
| libpq-dev       | latest     | `apt install libpq-dev` (PostgreSQL headers)         |
| ufw             | latest     | `apt install ufw`                                    |
| fail2ban        | latest     | `apt install fail2ban`                               |

### VM Network Security Group Rules

| Direction | Protocol | Port | Source       | Purpose                   |
| --------- | -------- | ---- | ------------ | ------------------------- |
| Inbound   | TCP      | 22   | Your IP only | SSH access                |
| Inbound   | TCP      | 80   | Any          | HTTP (redirects to HTTPS) |
| Inbound   | TCP      | 443  | Any          | HTTPS                     |
| Outbound  | TCP      | 5432 | Any          | PostgreSQL on Azure       |
| Outbound  | TCP      | 587  | Any          | SMTP (email sending)      |
| Outbound  | TCP      | 443  | Any          | Azure Blob, GitHub, npm   |

---

## Database Requirements

### PostgreSQL Server

| Requirement | Value                                          |
| ----------- | ---------------------------------------------- |
| Engine      | PostgreSQL 15                                  |
| Hosting     | Azure Database for PostgreSQL Flexible Server  |
| Tier        | B2s (minimum) — B4ms for production scale     |
| Storage     | 32 GB minimum — auto-grow enabled             |
| SSL         | Enforce SSL = Enabled                          |
| Firewall    | Allow VM private IP only (never public access) |
| Backup      | PITR enabled, 7-day retention minimum          |
| High Avail. | Zone-Redundant HA (recommended for production) |

### Database User Setup

Run these SQL commands on the PostgreSQL server to create the application database and user:

```sql
CREATE DATABASE aclp;
CREATE USER aclp_user WITH PASSWORD 'your-strong-password-here';
GRANT ALL PRIVILEGES ON DATABASE aclp TO aclp_user;
ALTER DATABASE aclp OWNER TO aclp_user;
```

### Connection String Format

```
postgres://aclp_user:<password>@<server>.postgres.database.azure.com:5432/aclp?sslmode=require
```

---

## Redis Requirements

| Requirement | Value                               |
| ----------- | ----------------------------------- |
| Version     | 7.x                                 |
| Deployment  | Docker container on the VM          |
| Image       | `redis:7-alpine`                  |
| Binding     | `127.0.0.1:6379` (localhost only) |
| Persistence | RDB snapshots (default)             |
| Memory      | 512 MB max recommended              |

**Start Redis:**

```bash
docker run -d \
  --name redis \
  --restart=always \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine
```

---

## Azure Blob Storage Requirements

| Requirement      | Value                               |
| ---------------- | ----------------------------------- |
| Account type     | StorageV2 (general purpose v2)      |
| Performance tier | Standard                            |
| Replication      | LRS minimum — GRS recommended      |
| Access tier      | Hot                                 |
| Container name   | `aclp-prod` (or your chosen name) |
| Container access | Private (anonymous access: None)    |
| Soft delete      | Enabled, 14-day retention           |
| TLS              | Require secure transfer = Enabled   |

**Required credentials:**

- Storage account name
- Storage account key (Key1 or Key2)

---

## Email / SMTP Requirements

One of the following SMTP providers is required for sending invitation and notification emails:

### Option A — Microsoft 365

| Setting  | Value                               |
| -------- | ----------------------------------- |
| HOST     | `smtp.office365.com`              |
| PORT     | `587`                             |
| TLS      | `True` (STARTTLS)                 |
| USER     | Your M365 email address             |
| PASSWORD | App password (not account password) |

> Enable SMTP AUTH for the sending mailbox in M365 Admin Center: Users → Active Users → [User] → Mail → Manage email apps → Authenticated SMTP.

### Option B — SendGrid (recommended for reliability)

| Setting  | Value                 |
| -------- | --------------------- |
| HOST     | `smtp.sendgrid.net` |
| PORT     | `587`               |
| TLS      | `True`              |
| USER     | `apikey`            |
| PASSWORD | Your SendGrid API key |

Free tier: 100 emails/day. Production tier: from $15/month for 50,000 emails.

### Option C — Any SMTP-Compatible Provider

- AWS SES, Mailgun, Postmark, or any standard SMTP relay

---

## DNS Requirements

| Record Type | Name               | Value        | TTL |
| ----------- | ------------------ | ------------ | --- |
| A           | yourdomain.com     | VM Public IP | 300 |
| A           | www.yourdomain.com | VM Public IP | 300 |

Wait for DNS propagation (up to 24 hours) before issuing the SSL certificate.

Verify propagation:

```bash
nslookup yourdomain.com
# Should return the VM public IP
```

---

## SSL Certificate Requirements

- Domain name must already point to the VM (DNS A record propagated)
- Port 80 must be open and Nginx must be running (for ACME challenge)
- Certbot needs: `apt install certbot python3-certbot-nginx`
- Email address for certificate expiry notifications

---

## Source Code Access Requirements

| Resource | Access Needed                                                  |
| -------- | -------------------------------------------------------------- |
| GitHub   | Read access to `https://github.com/Rutvik5o/EMS`             |
| SSH key  | VM SSH key pair (private key on workstation, public key on VM) |

---

## Credentials & Secrets Inventory

Before starting deployment, collect all of the following:

| Secret                    | Source                                                                     | Where used           |
| ------------------------- | -------------------------------------------------------------------------- | -------------------- |
| `SECRET_KEY`            | Generate:`python3 -c "import secrets; print(secrets.token_urlsafe(64))"` | Django settings      |
| `DATABASE_URL`          | Azure PostgreSQL server + database credentials                             | Django ORM           |
| `AZURE_ACCOUNT_NAME`    | Azure Portal → Storage Account                                            | File upload/download |
| `AZURE_ACCOUNT_KEY`     | Azure Portal → Storage Account → Access Keys                             | File upload/download |
| `AZURE_CONTAINER`       | The container name you created                                             | File upload/download |
| `EMAIL_HOST_USER`       | Your SMTP provider                                                         | Sending emails       |
| `EMAIL_HOST_PASSWORD`   | Your SMTP provider (app password)                                          | Sending emails       |
| `SENTRY_DSN` (optional) | sentry.io → Project → DSN                                                | Error tracking       |

---

## Workstation Requirements (for Deployment Engineer)

| Tool        | Version | Purpose                        |
| ----------- | ------- | ------------------------------ |
| SSH client  | Any     | Connect to Azure VM            |
| Azure CLI   | 2.x     | Manage Azure resources         |
| Git         | 2.x     | Verify repository              |
| curl        | Any     | Test HTTP endpoints            |
| Text editor | Any     | Edit configuration files on VM |

---
