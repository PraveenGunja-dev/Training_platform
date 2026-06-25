"""
Management command: import_classes_from_planner
Reads extracted_classes.json and inserts Class records into the DB.

Usage:
    python manage.py import_classes_from_planner
    python manage.py import_classes_from_planner --dry-run
    python manage.py import_classes_from_planner --json-path /custom/path.json
"""
import json
import re
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.groups.models import ClassGroup
from apps.scheduling.models import Class

DEFAULT_JSON = Path(__file__).parents[5] / "22-06-change(class-adding)" / "extracted_classes.json"

IST_OFFSET = timezone.timedelta(hours=5, minutes=30)


def make_ist_datetime(date_str: str, hour: int, minute: int = 0) -> datetime:
    """Create an IST-aware datetime from a YYYY-MM-DD string."""
    from datetime import timezone as dt_timezone
    ist = dt_timezone(IST_OFFSET)
    d = datetime.strptime(date_str, '%Y-%m-%d')
    return datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=ist)


class Command(BaseCommand):
    help = "Import class schedule from extracted_classes.json into scheduling_class table"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would be inserted without writing to DB')
        parser.add_argument('--json-path', type=str, default=str(DEFAULT_JSON), help='Path to extracted_classes.json')

    def handle(self, *args, **options):
        json_path = Path(options['json_path'])
        dry_run = options['dry_run']

        if not json_path.exists():
            self.stderr.write(self.style.ERROR(f"JSON file not found: {json_path}"))
            self.stderr.write("Run parse_planner.py first (Chunk 01).")
            return

        data = json.loads(json_path.read_text(encoding='utf-8'))
        records = data['records']
        self.stdout.write(f"Loaded {len(records)} records from {json_path}")

        # Build group name -> UUID map from DB
        group_map = {}
        for g in ClassGroup.objects.all():
            name = g.name.strip()
            group_map[name] = g
            # Also map by number for flexible matching (handles "Batch 20- GCC FMC 1" -> "Batch-20")
            m = re.search(r'\b(\d+)\b', name)
            if m:
                num = int(m.group(1))
                group_map[f'Batch-{num}'] = g
                group_map[f'Batch {num}'] = g

        self.stdout.write(f"Found {ClassGroup.objects.count()} groups in DB")

        inserted = 0
        skipped_dup = 0
        skipped_no_group = 0
        to_create = []

        for rec in records:
            batch_key = rec['batch_name']  # e.g. "Batch-1"
            group = group_map.get(batch_key)
            if group is None:
                self.stdout.write(self.style.WARNING(f"  No group found for '{batch_key}' — skipping"))
                skipped_no_group += 1
                continue

            starts_at = make_ist_datetime(rec['date'], 9, 0)
            ends_at   = make_ist_datetime(rec['date'], 18, 0)
            title     = rec['class_name'][:300]  # enforce max_length

            # Duplicate check
            exists = Class.objects.filter(
                group=group,
                title=title,
                starts_at__date=starts_at.date(),
            ).exists()
            if exists:
                skipped_dup += 1
                continue

            to_create.append(Class(
                group=group,
                title=title,
                starts_at=starts_at,
                ends_at=ends_at,
                status_cached=Class.STATUS_UPCOMING,
                created_by=None,
                description='',
                meeting_link='',
            ))

        self.stdout.write(f"\nReady to insert: {len(to_create)}")
        self.stdout.write(f"Skipped (duplicate): {skipped_dup}")
        self.stdout.write(f"Skipped (no group match): {skipped_no_group}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] No changes written to DB."))
            self.stdout.write("Sample of what would be inserted:")
            for c in to_create[:5]:
                self.stdout.write(f"  [{c.starts_at.date()}] {c.group.name}: {c.title}")
            return

        # Bulk insert (bypasses save(), so status_cached stays UPCOMING)
        Class.objects.bulk_create(to_create, batch_size=500, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f"\nInserted {len(to_create)} classes into scheduling_class"))
