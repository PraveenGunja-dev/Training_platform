"""Management command: create_qr_test_class

Creates a class whose ends_at is set to 2 minutes ago so the late-attendance
QR sharing button is immediately active (5-minute window after ends_at).

Usage:
    python manage.py create_qr_test_class
    python manage.py create_qr_test_class --group "Group Name"
"""
from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Create a test class ending 2 minutes ago for QR sharing tests."

    def add_arguments(self, parser):
        parser.add_argument("--group", default=None, help="Group name to attach the class to (default: first group)")

    def handle(self, *args, **options):
        from apps.groups.models import ClassGroup
        from apps.scheduling.models import Class

        if options["group"]:
            try:
                group = ClassGroup.objects.get(name=options["group"])
            except ClassGroup.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'Group "{options["group"]}" not found.'))
                return
        else:
            group = ClassGroup.objects.first()
            if not group:
                self.stderr.write(self.style.ERROR("No groups found. Run seed_demo first."))
                return

        now = timezone.now()
        starts_at = now - timedelta(hours=1)
        ends_at = now - timedelta(minutes=2)

        cls = Class.objects.create(
            group=group,
            title="[QR TEST] Late Attendance Test Class",
            description="Created by create_qr_test_class command. Delete after testing.",
            starts_at=starts_at,
            ends_at=ends_at,
            status_cached=Class.STATUS_COMPLETED,
        )

        self.stdout.write(self.style.SUCCESS(
            f'Created test class "{cls.title}" (ID: {cls.id})\n'
            f'  Group:    {group.name}\n'
            f'  Ends at:  {ends_at.strftime("%Y-%m-%d %H:%M:%S %Z")} (2 min ago)\n'
            f'  Window:   active for ~3 more minutes\n'
            f'  Admin:    http://localhost:5173/admin/classes'
        ))
