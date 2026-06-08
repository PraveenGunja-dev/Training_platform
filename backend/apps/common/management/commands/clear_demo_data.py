from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

PROTECTED_EMAIL = "kiran.kr@adani.com"


class Command(BaseCommand):
    help = "Wipe all demo/seed data while preserving the protected admin account."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt.",
        )

    def handle(self, *args, **options):
        if not options["yes"]:
            self.stdout.write(
                self.style.WARNING(
                    f"\nThis will permanently DELETE:\n"
                    "  • All users except {}\n"
                    "  • All groups, classes, assignments, attendance records\n"
                    "  • All documents and shared docs\n"
                    "  • All notifications and audit logs\n"
                    "  • All dashboard snapshots\n".format(PROTECTED_EMAIL)
                )
            )
            confirm = input("Type 'yes' to continue: ").strip().lower()
            if confirm != "yes":
                self.stdout.write("Aborted.")
                return

        from apps.accounts.models import User
        from apps.analytics.models import DashboardSnapshot
        from apps.audit.models import AuditLog
        from apps.groups.models import ClassGroup
        from apps.notifications.models import Notification

        self.stdout.write("\nClearing demo data...")

        with transaction.atomic():
            # 1. Audit logs (no blocking FKs)
            n, _ = AuditLog.objects.all().delete()
            self._log("Audit logs", n)

            # 2. Notifications (User CASCADE would handle these too, but be explicit)
            n, _ = Notification.objects.all().delete()
            self._log("Notifications", n)

            # 3. Dashboard snapshots (analytics cache — not linked to users/groups)
            n, _ = DashboardSnapshot.objects.all().delete()
            self._log("Dashboard snapshots", n)

            # 4. Groups — one delete cascades everything linked:
            #      GroupMembership, GroupInstructor
            #      Class → AttendanceSession → AttendanceRecord
            #      AssignmentTask → Submission → SubmissionReview
            #      Document, ParticipantUploadPermission, ParticipantSharedDoc
            n, detail = ClassGroup.objects.all().delete()
            self._log("Groups + all cascaded data", n, detail)

            # 5. Users (except protected admin) — cascades:
            #      PasswordSetupToken, NotificationPreference
            n, detail = User.objects.exclude(email=PROTECTED_EMAIL).delete()
            self._log("Users", n, detail)

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. '{PROTECTED_EMAIL}' is preserved.\n")
        )

    def _log(self, label: str, total: int, detail: dict | None = None) -> None:
        self.stdout.write(f"  {label}: {total} row(s) deleted")
        if detail:
            for model, count in sorted(detail.items()):
                if count:
                    self.stdout.write(f"      -> {model}: {count}")
