# Employee Management System — Backend

Django 5 + DRF + PostgreSQL + Celery + simplejwt

## Quickstart (Windows PowerShell)

```powershell
# 1. Start PostgreSQL + Redis via Docker
docker compose -f docker-compose.dev.yml up -d

# 2. Create a virtual environment and install dependencies
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Copy the environment template and fill in values
Copy-Item .env.example .env
# Edit .env — at minimum set SECRET_KEY (any random string is fine for dev)

# 4. Run database migrations
python manage.py migrate

# 5. Seed the demo dataset (creates 3 admins + 25 participants + groups + classes …)
python manage.py seed_demo

# 6. Start the development server
python manage.py runserver
```

The server runs at `http://localhost:8000`.

## Run tests

```powershell
pytest
```

## Run the Celery worker (optional — needed for async email + scheduled tasks)

```powershell
# Worker (use --pool=solo on Windows to avoid multiprocessing issues)
celery -A config worker -l info --pool=solo

# Beat scheduler (separate terminal)
celery -A config beat -l info
```

## Generate the OpenAPI schema

```powershell
python manage.py spectacular --color --file schema.yml
```

## API documentation

Visit `http://localhost:8000/api/docs/` for the interactive Swagger UI.

The raw OpenAPI YAML is at `http://localhost:8000/api/schema/`.

## Demo credentials (after seed_demo)

| Role | Email | Password |
|------|-------|----------|
| Admin | kiran.kr@adani.com | password123 |
| Admin | manish.kumar@adani.com | password123 |
| Admin | mira.sharma@adani.com | password123 |
| Participant | rutvik.prajapati@adani.com | password123 |
| Participant | priya.sharma@adani.com … gaurav.pandey@adani.com | password123 |

## Environment variables

Copy `.env.example` to `.env` and fill in values. **Never commit `.env`.**

Key variables:

| Variable | Description | Dev default |
|---|---|---|
| `SECRET_KEY` | Django secret key | *(required)* |
| `DEBUG` | Enable debug mode | `True` |
| `DATABASE_URL` | Postgres connection string | `postgres://ems_user:ems_pass@localhost:5432/ems_db` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379/0` |
| `EMAIL_BACKEND` | Email backend class | `django.core.mail.backends.console.EmailBackend` |
| `FRONTEND_URL` | Frontend origin (for links in emails) | `http://localhost:5173` |
| `AZURE_ACCOUNT_NAME` | Azure Blob Storage account | *(empty = mock SAS in dev)* |
| `AZURE_ACCOUNT_KEY` | Azure Blob Storage key | *(empty = mock SAS in dev)* |
| `AZURE_CONTAINER` | Blob container name | *(empty = mock SAS in dev)* |

## Project structure

```
backend/
├── config/             # Django project config (settings, urls, celery, wsgi)
│   └── settings/
│       ├── base.py     # Shared settings
│       ├── dev.py      # Development overrides
│       ├── production.py
│       └── test.py     # Test overrides (SQLite, locmem cache, eager Celery)
├── apps/
│   ├── accounts/       # Custom User + JWT auth + invite flow
│   ├── common/         # Shared models, permissions, pagination, seed command
│   ├── audit/          # AuditLog (append-only)
│   ├── groups/         # ClassGroup + GroupMembership
│   ├── scheduling/     # Class CRUD + /me/calendar
│   ├── attendance/     # AttendanceSession + AttendanceRecord + Start/End/Mark/Report
│   ├── assignments/    # AssignmentTask + Submission + Blob SAS upload
│   ├── documents/      # Document + shared-upload approval queue
│   ├── notifications/  # In-app Notification model + bell endpoints
│   └── analytics/      # Admin + Participant dashboard aggregations
├── requirements.txt
├── manage.py
└── docker-compose.dev.yml
```
