"""
seed_showcase management command.

Creates rich showcase data to demonstrate the full app to stakeholders.

Usage:
  python manage.py seed_showcase           # create / refresh showcase data
  python manage.py seed_showcase --clear   # remove all showcase data

Showcase participant login:
  Email:    demo@org.com
  Password: demo1234

Admin login (created by seed_demo, reused here):
  Email:    kiran.kr@adani.com
  Password: password123

Showcase group: "Demo Showcase Batch" (6 members including demo)

--clear deletes the group (cascades classes, tasks, docs, memberships,
attendance sessions + records, submissions) then deletes the 6 showcase
users (cascades notifications, residual memberships, submissions).
"""

from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.assignments.models import AssignmentTask, Submission
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.documents.models import Document
from apps.groups.models import ClassGroup, GroupMembership
from apps.notifications.models import Notification
from apps.scheduling.models import Class

_GROUP_NAME = "Demo Showcase Batch"
_DEMO_EMAIL = "demo@org.com"
_SUPPORT_EMAILS = [f"showcase{i}@org.com" for i in range(1, 6)]
_ALL_SHOWCASE_EMAILS = [_DEMO_EMAIL] + _SUPPORT_EMAILS
_PASSWORD = "demo1234"


class Command(BaseCommand):
    help = "Seed rich showcase data for demos. Use --clear to remove it."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Remove all showcase data and users.",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self._clear()
            return

        now = timezone.now()
        self.stdout.write("Seeding showcase data …")

        admin = self._get_or_create_admin()
        demo, supporters = self._seed_users()
        group = self._seed_group(admin)
        self._seed_memberships(group, [demo] + supporters)
        classes = self._seed_classes(group, admin, now)
        tasks = self._seed_tasks(group, classes, admin, now)
        ended_session, active_session = self._seed_attendance(
            classes, admin, demo, supporters, now
        )
        self._seed_submissions(tasks, demo, supporters, now)
        self._seed_documents(group, admin, classes)
        self._seed_notifications(
            demo, group, tasks, classes, ended_session, active_session, now
        )

        self.stdout.write(self.style.SUCCESS("\nShowcase data ready!"))
        self.stdout.write(f"  Participant  →  Email: {_DEMO_EMAIL}  |  Password: {_PASSWORD}")
        self.stdout.write("  Admin        →  Email: kiran.kr@adani.com  |  Password: password123")
        self.stdout.write(f"  Group: {_GROUP_NAME}")

    # ------------------------------------------------------------------
    # Clear
    # ------------------------------------------------------------------

    def _clear(self) -> None:
        self.stdout.write("Clearing showcase data …")
        deleted_groups, _ = ClassGroup.objects.filter(name=_GROUP_NAME).delete()
        self.stdout.write(f"  Deleted groups + cascades: {deleted_groups} rows")
        deleted_users, _ = User.objects.filter(email__in=_ALL_SHOWCASE_EMAILS).delete()
        self.stdout.write(f"  Deleted users + cascades:  {deleted_users} rows")
        self.stdout.write(self.style.SUCCESS("Showcase data cleared."))

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def _get_or_create_admin(self) -> User:
        user, created = User.objects.update_or_create(
            email="kiran.kr@adani.com",
            defaults={
                "full_name": "Kiran K R",
                "role": "ADMIN",
                "is_active": True,
                "is_staff": True,
            },
        )
        user.set_password("password123")
        user.save(update_fields=["password"])
        if created:
            self.stdout.write("  Admin created: kiran.kr@adani.com")
        return user

    def _seed_users(self) -> tuple[User, list[User]]:
        demo, created = User.objects.update_or_create(
            email=_DEMO_EMAIL,
            defaults={
                "full_name": "Demo Participant",
                "role": "PARTICIPANT",
                "is_active": True,
                "is_staff": False,
            },
        )
        demo.set_password(_PASSWORD)
        demo.save(update_fields=["password"])
        self.stdout.write(f"  Demo user {'created' if created else 'updated'}: {_DEMO_EMAIL}")

        supporters: list[User] = []
        for i, email in enumerate(_SUPPORT_EMAILS, 1):
            user, created = User.objects.update_or_create(
                email=email,
                defaults={
                    "full_name": f"Showcase Participant {i}",
                    "role": "PARTICIPANT",
                    "is_active": True,
                    "is_staff": False,
                },
            )
            user.set_password(_PASSWORD)
            user.save(update_fields=["password"])
            supporters.append(user)
        self.stdout.write(f"  {len(supporters)} supporting participants ready.")
        return demo, supporters

    # ------------------------------------------------------------------
    # Group
    # ------------------------------------------------------------------

    def _seed_group(self, creator: User) -> ClassGroup:
        group, created = ClassGroup.objects.update_or_create(
            name=_GROUP_NAME,
            defaults={
                "description": "Showcase group — rich data for stakeholder demos.",
                "is_archived": False,
                "created_by": creator,
            },
        )
        self.stdout.write(f"  Group {'created' if created else 'updated'}: {_GROUP_NAME}")
        return group

    def _seed_memberships(self, group: ClassGroup, members: list[User]) -> None:
        count = 0
        for user in members:
            _, created = GroupMembership.objects.get_or_create(user=user, group=group)
            if created:
                count += 1
        self.stdout.write(f"  {count} new memberships added (6 total in group).")

    # ------------------------------------------------------------------
    # Classes (8)
    # ------------------------------------------------------------------

    def _seed_classes(self, group: ClassGroup, creator: User, now) -> list[Class]:
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        day_after = today + timedelta(days=2)

        specs = [
            # title, description, starts_at, ends_at
            # 0: Completed 3h ago → 1h30m ago
            (
                "Data Ethics — Session 1",
                "Foundations of ethical AI and responsible data use.",
                now - timedelta(hours=3),
                now - timedelta(hours=1, minutes=30),
            ),
            # 1: Completed 1h15m ago → 15min ago (just finished)
            (
                "Machine Learning Basics",
                "Introduction to supervised and unsupervised learning algorithms.",
                now - timedelta(hours=1, minutes=15),
                now - timedelta(minutes=15),
            ),
            # 2: ONGOING now — started 45min ago, ends in 1h15min
            (
                "Python for Analytics",
                "Hands-on Python: pandas, matplotlib, and data wrangling.",
                now - timedelta(minutes=45),
                now + timedelta(hours=1, minutes=15),
            ),
            # 3: UPCOMING in ~35 minutes
            (
                "DevOps Fundamentals",
                "CI/CD pipelines, Docker, and infrastructure as code basics.",
                now + timedelta(minutes=35),
                now + timedelta(hours=2, minutes=35),
            ),
            # 4: UPCOMING in ~3.5 hours
            (
                "System Design Patterns",
                "Scalable system design: load balancing, caching, message queues.",
                now + timedelta(hours=3, minutes=30),
                now + timedelta(hours=5, minutes=30),
            ),
            # 5: Tomorrow morning
            (
                "Cloud Architecture",
                "AWS and Azure fundamentals: VMs, storage, networking, and IAM.",
                tomorrow.replace(hour=9, minute=30),
                tomorrow.replace(hour=11, minute=30),
            ),
            # 6: Tomorrow afternoon
            (
                "Security Best Practices",
                "Threat modelling, OWASP Top 10, and penetration testing intro.",
                tomorrow.replace(hour=14, minute=0),
                tomorrow.replace(hour=16, minute=0),
            ),
            # 7: Day after tomorrow
            (
                "Final Review & Q&A",
                "Capstone review of all modules, Q&A, and evaluation preparation.",
                day_after.replace(hour=10, minute=0),
                day_after.replace(hour=12, minute=0),
            ),
        ]

        classes: list[Class] = []
        for title, desc, starts_at, ends_at in specs:
            cls, _ = Class.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "description": desc,
                    "starts_at": starts_at,
                    "ends_at": ends_at,
                    "attendance_open_at": starts_at - timedelta(minutes=10),
                    "attendance_close_at": starts_at + timedelta(minutes=30),
                    "allow_late_attendance": True,
                    "created_by": creator,
                },
            )
            classes.append(cls)

        self.stdout.write(
            f"  {len(classes)} classes seeded "
            "(2 completed today, 1 ongoing, 2 upcoming today, 2 tomorrow, 1 day-after)."
        )
        return classes

    # ------------------------------------------------------------------
    # Assignment Tasks (5: 3 past+closed, 2 open)
    # ------------------------------------------------------------------

    def _seed_tasks(
        self,
        group: ClassGroup,
        classes: list[Class],
        creator: User,
        now,
    ) -> list[AssignmentTask]:
        specs = [
            # title, class_idx, open_delta, deadline_delta, policy, is_closed
            ("Data Ethics Case Study",   0, timedelta(days=-20), timedelta(days=-7),  "LATE_ALLOWED", True),
            ("ML Model Report",          1, timedelta(days=-15), timedelta(days=-5),  "STRICT",       True),
            ("Python Script Submission", 2, timedelta(days=-10), timedelta(days=-3),  "LATE_ALLOWED", True),
            ("DevOps Pipeline Design",   3, timedelta(days=-3),  timedelta(days=1),   "STRICT",       False),
            ("Cloud Migration Plan",     5, timedelta(days=-2),  timedelta(days=5),   "LATE_ALLOWED", False),
        ]

        tasks: list[AssignmentTask] = []
        for title, cls_idx, open_delta, deadline_delta, policy, is_closed in specs:
            class_obj = classes[cls_idx]
            open_at = now + open_delta
            deadline = now + deadline_delta
            if open_at >= deadline:
                open_at = deadline - timedelta(hours=2)
            is_open = (open_at <= now <= deadline) and not is_closed
            task, _ = AssignmentTask.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "question": (
                        f"Complete and submit your {title.lower()} following the provided guidelines."
                    ),
                    "description": (
                        f"This task assesses your understanding of topics covered in '{class_obj.title}'."
                    ),
                    "instructions": "Upload a single PDF file (max 20 MB). Include your name in the filename.",
                    "upload_open_at": open_at,
                    "deadline_at": deadline,
                    "late_policy": policy,
                    "reminder_offsets": [1440, 60],
                    "is_open": is_open,
                    "is_closed": is_closed,
                    "class_obj": class_obj,
                    "created_by": creator,
                },
            )
            tasks.append(task)

        self.stdout.write(f"  {len(tasks)} tasks seeded (3 closed with submissions, 2 open).")
        return tasks

    # ------------------------------------------------------------------
    # Submissions (demo: 3 past tasks; supporters: spread)
    # ------------------------------------------------------------------

    def _seed_submissions(
        self,
        tasks: list[AssignmentTask],
        demo: User,
        supporters: list[User],
        now,
    ) -> None:
        count = 0

        def _make(task, user, status, days_ago, filename, note=""):
            nonlocal count
            _, created = Submission.objects.update_or_create(
                task=task,
                user=user,
                version=1,
                defaults={
                    "file_url": f"showcase/{filename}",
                    "file_name": filename,
                    "file_type": "application/pdf",
                    "file_size": 1_048_576,
                    "status": status,
                    "submitted_at": now - timedelta(days=days_ago),
                    "submitted_by": None,
                    "note": note,
                },
            )
            if created:
                count += 1

        # Demo participant: one on each of the 3 closed tasks
        _make(tasks[0], demo,         "LATE_SUBMITTED", 5, "demo_data_ethics_case_study.pdf",
              "Submitted late — internet outage during deadline week.")
        _make(tasks[1], demo,         "SUBMITTED",       4, "demo_ml_model_report.pdf")
        _make(tasks[2], demo,         "SUBMITTED",       1, "demo_python_script_submission.pdf")

        # Supporters spread across the same closed tasks
        _make(tasks[0], supporters[0], "SUBMITTED",       8, "s1_data_ethics.pdf")
        _make(tasks[0], supporters[1], "LATE_SUBMITTED",  4, "s2_data_ethics.pdf")
        _make(tasks[1], supporters[2], "SUBMITTED",       6, "s3_ml_report.pdf")
        _make(tasks[1], supporters[3], "SUBMITTED",       5, "s4_ml_report.pdf")
        _make(tasks[2], supporters[4], "SUBMITTED",       2, "s5_python_script.pdf")

        self.stdout.write(f"  {count} new submissions seeded (3 by demo, 5 by supporters).")

    # ------------------------------------------------------------------
    # Attendance Sessions (1 ENDED + 1 ACTIVE)
    # ------------------------------------------------------------------

    def _seed_attendance(
        self,
        classes: list[Class],
        admin: User,
        demo: User,
        supporters: list[User],
        now,
    ) -> tuple[AttendanceSession, AttendanceSession]:
        # Session 1: ENDED — for "Data Ethics — Session 1" (class[0])
        ended_session, _ = AttendanceSession.objects.update_or_create(
            class_obj=classes[0],
            status="ENDED",
            defaults={
                "started_at": classes[0].starts_at + timedelta(minutes=2),
                "started_by": admin,
                "ended_at": classes[0].ends_at - timedelta(minutes=5),
                "ended_by": admin,
            },
        )
        # demo + showcase1/2/3 present; showcase4/5 absent (no record = absent in report)
        for user, mins in [
            (demo,           3),
            (supporters[0],  4),
            (supporters[1],  5),
            (supporters[2],  6),
        ]:
            AttendanceRecord.objects.update_or_create(
                session=ended_session,
                user=user,
                defaults={
                    "marked_at": classes[0].starts_at + timedelta(minutes=mins),
                    "status": "PRESENT",
                },
            )

        # Session 2: ACTIVE — for "Python for Analytics" (class[2], ongoing now)
        active_session, _ = AttendanceSession.objects.update_or_create(
            class_obj=classes[2],
            status="ACTIVE",
            defaults={
                "started_at": classes[2].starts_at + timedelta(minutes=2),
                "started_by": admin,
                "ended_at": None,
                "ended_by": None,
            },
        )
        # demo + showcase1/2 present; showcase3/4/5 absent (no record)
        for user, mins in [
            (demo,           3),
            (supporters[0],  4),
            (supporters[1],  5),
        ]:
            AttendanceRecord.objects.update_or_create(
                session=active_session,
                user=user,
                defaults={
                    "marked_at": classes[2].starts_at + timedelta(minutes=mins),
                    "status": "PRESENT",
                },
            )

        self.stdout.write("  2 attendance sessions seeded (1 ENDED with 4 present, 1 ACTIVE with 3 present).")
        return ended_session, active_session

    # ------------------------------------------------------------------
    # Documents (5: 4 visible to participants, 1 staff-only)
    # ------------------------------------------------------------------

    def _seed_documents(
        self, group: ClassGroup, uploader: User, classes: list[Class]
    ) -> None:
        specs = [
            # title, doc_type, visibility, filename, class_obj
            ("Python for Analytics — Slides",        "SLIDES",    "GROUP",      "python_analytics_slides.pdf",    classes[2]),
            ("Machine Learning Lecture Notes",        "GUIDE",     "GROUP",      "ml_lecture_notes.pdf",           classes[1]),
            ("Data Ethics Case Studies Collection",   "REFERENCE", "GROUP",      "data_ethics_cases.pdf",          classes[0]),
            ("DevOps Quick Reference Card",           "TEMPLATE",  "GROUP",      "devops_reference.pdf",           classes[3]),
            ("Admin Training Materials Q2",           "REPORT",    "STAFF_ONLY", "admin_training_q2.pdf",          None),
        ]
        count = 0
        for title, doc_type, visibility, filename, class_obj in specs:
            _, created = Document.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "file_url": f"showcase/{filename}",
                    "file_name": filename,
                    "file_type": "application/pdf",
                    "file_size": 2_097_152,
                    "doc_type": doc_type,
                    "visibility": visibility,
                    "allowed_user_ids": [],
                    "class_obj": class_obj,
                    "uploaded_by": uploader,
                },
            )
            if created:
                count += 1
        self.stdout.write(
            f"  {count} new documents seeded (4 visible to participants, 1 staff-only)."
        )

    # ------------------------------------------------------------------
    # Notifications for demo participant (8: 5 read, 3 unread)
    # ------------------------------------------------------------------

    def _seed_notifications(
        self,
        demo: User,
        group: ClassGroup,
        tasks: list[AssignmentTask],
        classes: list[Class],
        ended_session: AttendanceSession,
        active_session: AttendanceSession,
        now,
    ) -> None:
        d0_deadline = (now - timedelta(days=7)).strftime("%d %b %Y")
        d1_deadline = (now - timedelta(days=5)).strftime("%d %b %Y")
        d2_deadline = (now - timedelta(days=3)).strftime("%d %b %Y")

        specs = [
            # type, title, body, link, dedupe_suffix, days_ago, is_read
            (
                "GROUP_ADDED",
                f"Added to {group.name}",
                f"You have been added to the group '{group.name}'. Welcome!",
                "/groups",
                "group-added",
                21, True,
            ),
            (
                "TASK_OPENED",
                f"New task: {tasks[0].title}",
                f"A new assignment '{tasks[0].title}' is now open. Deadline: {d0_deadline}.",
                f"/tasks/{tasks[0].id}",
                f"task-opened-{tasks[0].id}",
                20, True,
            ),
            (
                "TASK_OPENED",
                f"New task: {tasks[1].title}",
                f"A new assignment '{tasks[1].title}' is now open. Deadline: {d1_deadline}.",
                f"/tasks/{tasks[1].id}",
                f"task-opened-{tasks[1].id}",
                15, True,
            ),
            (
                "DEADLINE_REMINDER",
                f"Deadline reminder: {tasks[0].title}",
                f"Your submission for '{tasks[0].title}' is due in 24 hours.",
                f"/tasks/{tasks[0].id}",
                f"deadline-24h-{tasks[0].id}",
                8, True,
            ),
            (
                "TASK_OPENED",
                f"New task: {tasks[2].title}",
                f"A new assignment '{tasks[2].title}' is now open. Deadline: {d2_deadline}.",
                f"/tasks/{tasks[2].id}",
                f"task-opened-{tasks[2].id}",
                10, True,
            ),
            (
                "ATTENDANCE_SESSION_STARTED",
                f"Attendance open: {classes[0].title}",
                f"Attendance has been started for '{classes[0].title}'. Mark your attendance now.",
                f"/classes/{classes[0].id}",
                f"att-started-{ended_session.id}",
                4, True,
            ),
            (
                "ATTENDANCE_SESSION_ENDED",
                f"Attendance closed: {classes[0].title}",
                f"The attendance session for '{classes[0].title}' has ended. You were marked Present.",
                f"/classes/{classes[0].id}",
                f"att-ended-{ended_session.id}",
                4, False,
            ),
            (
                "ATTENDANCE_SESSION_STARTED",
                f"Attendance open: {classes[2].title}",
                f"Attendance has been started for '{classes[2].title}'. Mark your attendance now.",
                f"/classes/{classes[2].id}",
                f"att-started-{active_session.id}",
                0, False,
            ),
        ]

        count = 0
        for ntype, title, body, link, dedupe_suffix, days_ago, is_read in specs:
            sent_at = now - timedelta(days=days_ago)
            read_at = sent_at + timedelta(hours=2) if is_read else None
            _, created = Notification.objects.update_or_create(
                dedupe_key=f"showcase-demo-{dedupe_suffix}",
                defaults={
                    "user": demo,
                    "type": ntype,
                    "channel": "IN_APP",
                    "title": title,
                    "body": body,
                    "link": link,
                    "status": "SENT",
                    "read_at": read_at,
                    "sent_at": sent_at,
                    "payload": {},
                },
            )
            if created:
                count += 1

        self.stdout.write(
            f"  {count} new notifications seeded for demo (5 read, 3 unread)."
        )
