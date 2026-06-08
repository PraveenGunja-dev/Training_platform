"""
clear_dummy_data.py
-------------------
Run from the backend/ directory:

    python clear_dummy_data.py

Erases ALL seeded dummy data while keeping the database schema intact.
After running, execute seed_demo + seed_rich to repopulate.

What is deleted (in safe FK order):
  Submissions, AttendanceRecords, AttendanceSessions,
  Notifications, AuditLog (seeded entries), AssignmentTasks,
  Documents, ParticipantSharedDocs, ParticipantUploadPermissions,
  Classes, GroupMemberships, ClassGroups,
  Participant Users (role=PARTICIPANT)

What is kept:
  Admin Users, SystemSettings, django_* tables, token_blacklist, celery_beat
"""

import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django.setup()

from django.db import transaction

from apps.accounts.models import User
from apps.assignments.models import AssignmentTask, Submission
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.audit.models import AuditLog
from apps.documents.models import Document, ParticipantSharedDoc, ParticipantUploadPermission
from apps.groups.models import ClassGroup, GroupMembership
from apps.notifications.models import Notification
from apps.scheduling.models import Class


def confirm(prompt: str) -> bool:
    answer = input(f"{prompt} [yes/no]: ").strip().lower()
    return answer == "yes"


def main():
    print("=" * 60)
    print("  EMS Dummy Data Cleaner")
    print("=" * 60)

    # Count existing data
    counts = {
        "Submissions":             Submission.objects.count(),
        "AttendanceRecords":       AttendanceRecord.objects.count(),
        "AttendanceSessions":      AttendanceSession.objects.count(),
        "Notifications":           Notification.objects.count(),
        "AuditLog entries":        AuditLog.objects.count(),
        "AssignmentTasks":         AssignmentTask.objects.count(),
        "Documents":               Document.objects.count(),
        "ParticipantSharedDocs":   ParticipantSharedDoc.objects.count(),
        "UploadPermissions":       ParticipantUploadPermission.objects.count(),
        "Classes":                 Class.objects.count(),
        "GroupMemberships":        GroupMembership.objects.count(),
        "ClassGroups":             ClassGroup.objects.count(),
        "Participant Users":       User.objects.filter(role="PARTICIPANT").count(),
    }

    print("\nCurrent data:")
    for label, count in counts.items():
        print(f"  {label:<30} {count:>6}")

    admins = User.objects.filter(role="ADMIN").count()
    print(f"\n  Admin users (will be kept):    {admins}")
    print()

    if not confirm("Delete ALL dummy data listed above?"):
        print("Aborted — nothing deleted.")
        sys.exit(0)

    print("\nDeleting …")

    with transaction.atomic():
        n = Submission.objects.all().delete()
        print(f"  Submissions deleted:              {n[0]}")

        n = AttendanceRecord.objects.all().delete()
        print(f"  AttendanceRecords deleted:        {n[0]}")

        n = AttendanceSession.objects.all().delete()
        print(f"  AttendanceSessions deleted:       {n[0]}")

        n = Notification.objects.all().delete()
        print(f"  Notifications deleted:            {n[0]}")

        n = AuditLog.objects.filter(metadata__note="seeded").delete()
        print(f"  AuditLog (seeded) deleted:        {n[0]}")

        n = AssignmentTask.objects.all().delete()
        print(f"  AssignmentTasks deleted:          {n[0]}")

        n = ParticipantSharedDoc.objects.all().delete()
        print(f"  ParticipantSharedDocs deleted:    {n[0]}")

        n = ParticipantUploadPermission.objects.all().delete()
        print(f"  UploadPermissions deleted:        {n[0]}")

        n = Document.objects.all().delete()
        print(f"  Documents deleted:                {n[0]}")

        n = Class.objects.all().delete()
        print(f"  Classes deleted:                  {n[0]}")

        n = GroupMembership.objects.all().delete()
        print(f"  GroupMemberships deleted:         {n[0]}")

        n = ClassGroup.objects.all().delete()
        print(f"  ClassGroups deleted:              {n[0]}")

        n = User.objects.filter(role="PARTICIPANT").delete()
        print(f"  Participant Users deleted:        {n[0]}")

    print("\nDone. Database is clean.")
    print("Run the following to reseed:")
    print("  python manage.py seed_demo")
    print("  python manage.py seed_rich")


if __name__ == "__main__":
    main()
