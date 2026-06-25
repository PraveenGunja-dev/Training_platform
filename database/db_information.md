# Database Information — ACLP TMS Deployment 4.0

**Dump file:** `aclp_tms_dump_22_06_2026.dump`
**Dump date:** 22 June 2026
**PostgreSQL version:** 18
**Database name:** `ems_db`
**Format:** Custom (`pg_dump -Fc`) — restore with `pg_restore`

---

## Database Credentials

| Field | Value |
|-------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database name** | `ems_db` |
| **Username** | `ems_user` |
| **Password** | `ems_pass` |

**Full connection string (for `backend/.env`):**
```
DATABASE_URL=postgres://ems_user:ems_pass@localhost:5432/ems_db
```

> **Note:** Change the password in production. Update `DATABASE_URL` in `backend/.env` to match your actual host/credentials.

---

## Restore Instructions

```bash
# 1. Create the user and database (as postgres superuser)
psql -U postgres -c "CREATE USER ems_user WITH PASSWORD 'ems_pass';"
psql -U postgres -c "CREATE DATABASE ems_db OWNER ems_user;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ems_db TO ems_user;"

# 2. Restore the dump
pg_restore -h localhost -p 5432 -U ems_user -d ems_db --no-owner --role=ems_user aclp_tms_dump_22_06_2026.dump

# 3. Apply any pending migrations (if running fresh backend)
python manage.py migrate
```

After restore, set the `DATABASE_URL` in `backend/.env`:
```
DATABASE_URL=postgres://ems_user:ems_pass@localhost:5432/ems_db
```

---

## Storage Model

As of Deployment 4.0, **all file binaries are stored directly in PostgreSQL** (`BinaryField` columns).
There is no dependency on Azure Blob Storage or any local `local_storage/` folder.

| App | Model | Column | What is stored |
|-----|-------|--------|----------------|
| accounts | `User` | `photo_data` | Profile photo binary |
| accounts | `User` | `photo_content_type` | MIME type of photo |
| documents | `Document` | `file_data` | Class document binary |
| documents | `ParticipantSharedDoc` | `file_data` | Participant shared upload binary |
| assignments | `AssignmentTask` | `question_file_data` | Question/instruction file binary |
| assignments | `Submission` | `file_data` | Participant submission file binary |

---

## Table Summary

### Users & Authentication (`accounts` app)

| Table | Rows | Notes |
|-------|------|-------|
| `accounts_user` | **1 212** | All system users |
| `accounts_user` → ADMIN | 1 | Super-admin account |
| `accounts_user` → INSTRUCTOR | 55 | Teaching staff |
| `accounts_user` → PARTICIPANT | 1 129 | Learners/employees |
| `accounts_user` → GROUP_ADMIN | 27 | Group administrators |
| `token_blacklist_outstandingtoken` | varies | JWT outstanding tokens |
| `token_blacklist_blacklistedtoken` | varies | Invalidated JWTs |

### Groups (`groups` app)

| Table | Rows | Notes |
|-------|------|-------|
| `groups_classgroup` | **25** | Training groups |
| `groups_subgroup` | **7** | Sub-divisions within groups |
| `groups_groupmembership` | **1 129** | User ↔ group assignments |
| `groups_subgroupmembership` | **46** | User ↔ sub-group assignments |
| `groups_groupinstructor` | **51** | Instructor ↔ group assignments |
| `groups_groupadmin` | **25** | Group admin ↔ group assignments |

### Scheduling (`scheduling` app)

| Table | Rows | Notes |
|-------|------|-------|
| `scheduling_class` | **1 201** | All classes / sessions |
| `scheduling_class` → UPCOMING | 916 | Scheduled but not yet started |
| `scheduling_class` → COMPLETED | 285 | Past classes |
| `scheduling_class` → ONGOING | 0 | None currently in progress |
| `scheduling_class` → CANCELLED | 0 | No cancellations recorded |

### Attendance (`attendance` app)

| Table | Rows | Notes |
|-------|------|-------|
| `attendance_attendancesession` | **0** | No attendance sessions opened yet |
| `attendance_attendancerecord` | **0** | No attendance records |

### Documents (`documents` app)

| Table | Rows | Notes |
|-------|------|-------|
| `documents_document` | **13** | Class-linked documents (PDF/PPTX/etc.) |
| `documents_participantshareddoc` | **0** | Participant-submitted shared docs |

### Assignments (`assignments` app)

| Table | Rows | Notes |
|-------|------|-------|
| `assignments_assignmenttask` | **0** | No assignments created yet |
| `assignments_submission` | **0** | No submissions |
| `assignments_submissionreview` | **0** | No reviews |

### Notifications & Audit

| Table | Rows | Notes |
|-------|------|-------|
| `notifications_notification` | **679** | System notifications |
| `audit_auditlog` | **74** | Admin audit trail entries |

---

## System Settings

| Setting | Value |
|---------|-------|
| `common_systemsettings` | 1 row — singleton config |
| Default class visibility for instructors | `inherit` (use system default) |

---

## Key Relationships

```
User (1) ──── (M) GroupMembership ──── (1) ClassGroup
ClassGroup (1) ──── (M) Class
Class (1) ──── (M) AssignmentTask
AssignmentTask (1) ──── (M) Submission
Submission (1) ──── (1) SubmissionReview
Class (1) ──── (M) AttendanceSession
AttendanceSession (1) ──── (M) AttendanceRecord
ClassGroup (1) ──── (M) Document
ClassGroup (1) ──── (M) SubGroup
SubGroup (M) ──── (M) User  [via SubGroupMembership]
```