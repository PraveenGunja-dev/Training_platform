"""
Management command: import_detu
Reads detu.xlsx from the project root, creates 25 batch groups,
registers ~1128 participants, and wires up coordinator-instructors.

Usage:
    python manage.py import_detu
    python manage.py import_detu --xlsx /path/to/detu.xlsx
    python manage.py import_detu --dry-run
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

import openpyxl


XLSX_DEFAULT = Path(__file__).resolve().parents[5] / "detu.xlsx"

COORDINATOR_NAME_MAP = {
    "Divyansh Jha": "divyansh.jha@adani.com",
    "Vineet Jain": "vineet.jain1@adani.com",
    "Shubham Tomar": "shubham.tomar@adani.com",
    "Disha Gadhvi": "disha.gadhvi@adani.com",
}


def _normalize_batch(raw: str) -> str:
    """'Batch - 21' → 'Batch-21'"""
    m = re.search(r"\d+", str(raw))
    if not m:
        raise ValueError(f"Cannot parse batch number from: {raw!r}")
    return f"Batch-{int(m.group())}"


class Command(BaseCommand):
    help = "Import detu.xlsx: create batch groups, participant users, and instructor assignments."

    def add_arguments(self, parser):
        parser.add_argument("--xlsx", default=str(XLSX_DEFAULT), help="Path to detu.xlsx")
        parser.add_argument("--dry-run", action="store_true", help="Parse but do not write to DB")

    def handle(self, *args, **options):
        from apps.accounts.models import User
        from apps.groups.models import ClassGroup, GroupInstructor, GroupMembership

        xlsx_path = options["xlsx"]
        dry_run = options["dry_run"]

        if not os.path.exists(xlsx_path):
            raise CommandError(f"File not found: {xlsx_path}")

        self.stdout.write(f"Reading {xlsx_path} …")
        wb = openpyxl.load_workbook(xlsx_path, data_only=True, read_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(min_row=2, values_only=True))
        wb.close()
        self.stdout.write(f"  {len(rows)} data rows found.")

        # Resolve coordinator Users
        coordinator_users: dict[str, User] = {}
        for name, email in COORDINATOR_NAME_MAP.items():
            try:
                coordinator_users[name] = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                raise CommandError(
                    f"Coordinator '{name}' not found in DB (expected email {email}). "
                    "Run migrations and ensure these 4 instructors exist."
                )
        self.stdout.write(f"  {len(coordinator_users)} coordinators resolved.")

        # Parse rows
        batch_participants: dict[str, list[dict]] = {}
        batch_coordinator: dict[str, str] = {}  # batch_name → coordinator full_name
        skipped = 0

        for i, row in enumerate(rows, start=2):
            emp_code, name, batch_raw, biz_unit, email, coordinator, grade_code, department = (
                row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]
            )

            if not email or not batch_raw:
                self.stdout.write(self.style.WARNING(f"  Row {i}: missing email or batch, skipping."))
                skipped += 1
                continue

            email = str(email).strip().lower()
            batch = _normalize_batch(batch_raw)
            coordinator = str(coordinator).strip() if coordinator else ""

            batch_participants.setdefault(batch, []).append({
                "email": email,
                "full_name": str(name).strip() if name else email,
                "employee_code": str(emp_code).strip() if emp_code else "",
                "business_unit": str(biz_unit).strip() if biz_unit else "",
                "grade_code": str(grade_code).strip() if grade_code else "",
                "department": str(department).strip() if department else "",
            })

            if coordinator and batch not in batch_coordinator:
                batch_coordinator[batch] = coordinator

        self.stdout.write(f"  {len(batch_participants)} batches parsed, {skipped} rows skipped.")

        if dry_run:
            for b in sorted(batch_participants):
                coord = batch_coordinator.get(b, "—")
                self.stdout.write(f"  {b}: {len(batch_participants[b])} participants, coordinator={coord}")
            self.stdout.write(self.style.SUCCESS("Dry run complete — nothing written."))
            return

        # Write to DB
        hashed_password = make_password("admin123")
        created_groups = created_users = created_members = created_instructors = 0
        updated_users = 0

        with transaction.atomic():
            for batch_name in sorted(batch_participants.keys()):
                participants = batch_participants[batch_name]
                coordinator_name = batch_coordinator.get(batch_name, "")

                # Create / get group
                group, g_created = ClassGroup.objects.get_or_create(
                    name=batch_name,
                    defaults={"description": f"Auto-imported batch: {batch_name}"},
                )
                if g_created:
                    created_groups += 1

                # Assign coordinator as instructor
                if coordinator_name and coordinator_name in coordinator_users:
                    coord_user = coordinator_users[coordinator_name]
                    _, gi_created = GroupInstructor.objects.get_or_create(
                        group=group,
                        instructor=coord_user,
                    )
                    if gi_created:
                        created_instructors += 1
                elif coordinator_name:
                    self.stdout.write(
                        self.style.WARNING(f"  Unknown coordinator '{coordinator_name}' for {batch_name}")
                    )

                # Create participant users and memberships
                for p in participants:
                    user, u_created = User.objects.get_or_create(
                        email=p["email"],
                        defaults={
                            "full_name": p["full_name"],
                            "role": "PARTICIPANT",
                            "password": hashed_password,
                            "must_change_password": True,
                            "employee_code": p["employee_code"],
                            "business_unit": p["business_unit"],
                            "grade_code": p["grade_code"],
                            "department": p["department"],
                            "is_active": True,
                        },
                    )
                    if u_created:
                        created_users += 1
                    else:
                        # Update profile fields for existing users
                        changed = False
                        for field in ("employee_code", "business_unit", "grade_code", "department", "full_name"):
                            if p[field] and getattr(user, field) != p[field]:
                                setattr(user, field, p[field])
                                changed = True
                        if changed:
                            user.save(update_fields=["employee_code", "business_unit", "grade_code", "department", "full_name"])
                            updated_users += 1

                    _, m_created = GroupMembership.objects.get_or_create(
                        user=user, group=group
                    )
                    if m_created:
                        created_members += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone!\n"
            f"  Groups created:      {created_groups}\n"
            f"  Users created:       {created_users}\n"
            f"  Users updated:       {updated_users}\n"
            f"  Memberships created: {created_members}\n"
            f"  Instructors wired:   {created_instructors}\n"
            f"  Rows skipped:        {skipped}"
        ))
