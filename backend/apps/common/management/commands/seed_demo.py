"""
seed_demo management command.

Creates a consistent demo dataset for development:
  - 3 ADMIN users
  - 25 PARTICIPANT users
  - 4 ClassGroups (~6 participants each)
  - 12 Classes (3 per group: past / ongoing / future)
  - 0 AttendanceSessions (admin starts live during demo)
  - 8 AssignmentTasks (mix of STRICT / LATE_ALLOWED / ADMIN_ONLY)
  - 5 Documents (mix of all visibility levels)
  - 5 PENDING ParticipantSharedDocs

Idempotent: re-running uses update_or_create / get_or_create so state stays
consistent regardless of how many times it has been run before.
"""

from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.assignments.models import AssignmentTask
from apps.common.models import SystemSettings
from apps.documents.models import Document, ParticipantSharedDoc, ParticipantUploadPermission
from apps.groups.models import ClassGroup, GroupMembership
from apps.scheduling.models import Class


class Command(BaseCommand):
    help = "Seed the database with demo data for development / presentation."

    def handle(self, *args: object, **options: object) -> None:
        self.stdout.write("Seeding demo data …")

        now = timezone.now()
        admins = self._seed_admins()
        self._seed_instructor()
        participants = self._seed_participants()
        groups = self._seed_groups(admins[0])
        self._seed_memberships(groups, participants)
        classes = self._seed_classes(groups, admins[0], now)
        self._seed_tasks(groups, classes, admins[0], now)
        self._seed_documents(groups, admins[0])
        self._seed_shared_docs(groups, participants)
        SystemSettings.get_solo()  # ensure singleton row exists with defaults
        self.stdout.write("  SystemSettings singleton ready.")

        self.stdout.write(self.style.SUCCESS("Done. Demo dataset is ready."))

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def _seed_instructor(self) -> User:
        user, created = User.objects.update_or_create(
            email="dev-instructor@example.com",
            defaults={
                "full_name": "Dev Instructor",
                "role": "INSTRUCTOR",
                "is_active": True,
                "is_staff": False,
            },
        )
        user.set_password("password123")
        user.save(update_fields=["password"])
        status = "created" if created else "updated"
        self.stdout.write(f"  Instructor {status}: dev-instructor@example.com")
        return user

    def _seed_admins(self) -> list[User]:
        admin_data = [
            ("kiran.kr@adani.com",  "Kiran K R"),
            ("manish.kumar@adani.com", "Manish Kumar"),
            ("mira.sharma@adani.com",  "Mira Sharma"),
        ]
        admins: list[User] = []
        for email, full_name in admin_data:
            user, created = User.objects.update_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "role": "ADMIN",
                    "is_active": True,
                    "is_staff": True,
                },
            )
            user.set_password("password123")
            user.save(update_fields=["password"])
            admins.append(user)
            status = "created" if created else "updated"
            self.stdout.write(f"  Admin {status}: {email}")
        return admins

    def _seed_participants(self) -> list[User]:
        participant_data = [
            ("rutvik.prajapati@adani.com",  "Rutvik Prajapati"),
            ("priya.sharma@adani.com",       "Priya Sharma"),
            ("arjun.mehta@adani.com",        "Arjun Mehta"),
            ("divya.nair@adani.com",         "Divya Nair"),
            ("rohan.verma@adani.com",        "Rohan Verma"),
            ("sneha.patel@adani.com",        "Sneha Patel"),
            ("vikram.singh@adani.com",       "Vikram Singh"),
            ("anita.desai@adani.com",        "Anita Desai"),
            ("rahul.gupta@adani.com",        "Rahul Gupta"),
            ("kavya.reddy@adani.com",        "Kavya Reddy"),
            ("amit.kumar@adani.com",         "Amit Kumar"),
            ("pooja.iyer@adani.com",         "Pooja Iyer"),
            ("suresh.joshi@adani.com",       "Suresh Joshi"),
            ("meera.pillai@adani.com",       "Meera Pillai"),
            ("nikhil.shah@adani.com",        "Nikhil Shah"),
            ("tanvi.saxena@adani.com",       "Tanvi Saxena"),
            ("deepak.rao@adani.com",         "Deepak Rao"),
            ("shreya.banerjee@adani.com",    "Shreya Banerjee"),
            ("karan.malhotra@adani.com",     "Karan Malhotra"),
            ("nisha.agarwal@adani.com",      "Nisha Agarwal"),
            ("sanjay.mishra@adani.com",      "Sanjay Mishra"),
            ("aisha.qureshi@adani.com",      "Aisha Qureshi"),
            ("ravi.krishnan@adani.com",      "Ravi Krishnan"),
            ("sonal.kapoor@adani.com",       "Sonal Kapoor"),
            ("gaurav.pandey@adani.com",      "Gaurav Pandey"),
        ]
        participants: list[User] = []
        for email, full_name in participant_data:
            user, created = User.objects.update_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "role": "PARTICIPANT",
                    "is_active": True,
                    "is_staff": False,
                },
            )
            user.set_password("password123")
            user.save(update_fields=["password"])
            participants.append(user)
            if created:
                self.stdout.write(f"  Participant created: {email}")
        self.stdout.write(f"  {len(participants)} participant users ready.")
        return participants

    # ------------------------------------------------------------------
    # Groups
    # ------------------------------------------------------------------

    def _seed_groups(self, creator: User) -> list[ClassGroup]:
        group_data = [
            ("Batch Alpha", "First cohort — safety and operations."),
            ("Batch Beta", "Second cohort — compliance and risk."),
            ("Batch Gamma", "Third cohort — leadership and strategy."),
            ("Batch Delta", "Fourth cohort — advanced practitioner track."),
        ]
        groups: list[ClassGroup] = []
        for name, description in group_data:
            group, created = ClassGroup.objects.update_or_create(
                name=name,
                defaults={
                    "description": description,
                    "is_archived": False,
                    "created_by": creator,
                },
            )
            groups.append(group)
            status = "created" if created else "updated"
            self.stdout.write(f"  Group {status}: {name}")
        return groups

    def _seed_memberships(
        self, groups: list[ClassGroup], participants: list[User]
    ) -> None:
        # Batch Alpha: p1-p6, Batch Beta: p7-p12,
        # Batch Gamma: p13-p18, Batch Delta: p19-p25
        slices = [
            (groups[0], participants[0:6]),
            (groups[1], participants[6:12]),
            (groups[2], participants[12:18]),
            (groups[3], participants[18:25]),
        ]
        total = 0
        for group, members in slices:
            for user in members:
                _, created = GroupMembership.objects.get_or_create(user=user, group=group)
                if created:
                    total += 1
        self.stdout.write(f"  {total} new group memberships added.")

    # ------------------------------------------------------------------
    # Classes
    # ------------------------------------------------------------------

    def _seed_classes(
        self, groups: list[ClassGroup], creator: User, now: object
    ) -> list[Class]:
        classes: list[Class] = []
        topic_names = [
            ("Safety Orientation", "Introduction to workplace safety protocols."),
            ("Risk Assessment Live", "Live session on risk identification techniques."),
            ("Advanced Safety Workshop", "Deep-dive into advanced safety frameworks."),
            ("Compliance Fundamentals", "Core compliance requirements and reporting."),
            ("Regulatory Review", "Review of current regulatory standards."),
            ("Audit Preparation", "Prepare teams for upcoming compliance audits."),
            ("Leadership Essentials", "Key leadership skills for team leads."),
            ("Strategy Alignment", "Aligning team goals with organizational strategy."),
            ("Executive Communication", "Effective communication for senior staff."),
            ("Practitioner Bootcamp", "Intensive advanced practitioner session."),
            ("Case Study Analysis", "Real-world case study review and discussion."),
            ("Capstone Session", "Final review and Q&A session for cohort."),
        ]
        class_idx = 0
        for group in groups:
            topic_base = class_idx
            # Past class (COMPLETED)
            title, desc = topic_names[topic_base]
            past_start = now - timedelta(days=30, hours=2)
            past_end = past_start + timedelta(hours=2)
            cls, _ = Class.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "description": desc,
                    "starts_at": past_start,
                    "ends_at": past_end,
                    "attendance_open_at": past_start - timedelta(minutes=10),
                    "attendance_close_at": past_start + timedelta(minutes=30),
                    "allow_late_attendance": False,
                    "created_by": creator,
                },
            )
            classes.append(cls)

            # Ongoing class (today, within window)
            title, desc = topic_names[topic_base + 1]
            live_start = now - timedelta(hours=1)
            live_end = now + timedelta(hours=1)
            cls, _ = Class.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "description": desc,
                    "starts_at": live_start,
                    "ends_at": live_end,
                    "attendance_open_at": live_start - timedelta(minutes=10),
                    "attendance_close_at": live_start + timedelta(minutes=30),
                    "allow_late_attendance": False,
                    "created_by": creator,
                },
            )
            classes.append(cls)

            # Future class (UPCOMING)
            title, desc = topic_names[topic_base + 2]
            future_start = now + timedelta(days=7)
            future_end = future_start + timedelta(hours=2)
            cls, _ = Class.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "description": desc,
                    "starts_at": future_start,
                    "ends_at": future_end,
                    "attendance_open_at": future_start - timedelta(minutes=10),
                    "attendance_close_at": future_start + timedelta(minutes=30),
                    "allow_late_attendance": False,
                    "created_by": creator,
                },
            )
            classes.append(cls)

            class_idx += 3

        self.stdout.write(f"  {len(classes)} classes seeded (past/ongoing/future per group).")
        return classes

    # ------------------------------------------------------------------
    # Assignment Tasks
    # ------------------------------------------------------------------

    def _seed_tasks(
        self,
        groups: list[ClassGroup],
        classes: list[Class],
        creator: User,
        now: object,
    ) -> None:
        task_specs = [
            # (group_idx, title, policy, open_delta, deadline_delta)
            (0, "Safety Protocols Report", "STRICT", timedelta(days=-7), timedelta(days=3)),
            (0, "Incident Analysis Essay", "LATE_ALLOWED", timedelta(days=-14), timedelta(days=-2)),
            (1, "Risk Assessment Matrix", "STRICT", timedelta(days=-5), timedelta(days=5)),
            (1, "Regulatory Compliance Audit", "LATE_ALLOWED", timedelta(days=-3), timedelta(days=7)),
            (2, "Leadership Case Study", "ADMIN_ONLY", timedelta(days=-10), timedelta(days=1)),
            (2, "Strategy Presentation", "STRICT", timedelta(days=-2), timedelta(days=10)),
            (3, "Advanced Practitioner Review", "LATE_ALLOWED", timedelta(days=-6), timedelta(days=4)),
            (3, "Capstone Submission", "ADMIN_ONLY", timedelta(days=-1), timedelta(days=14)),
        ]
        count = 0
        for group_idx, title, policy, open_delta, deadline_delta in task_specs:
            group = groups[group_idx]
            open_at = now + open_delta
            deadline = now + deadline_delta
            # Ensure open_at is always before deadline
            if open_at >= deadline:
                open_at = deadline - timedelta(hours=2)
            is_open = open_at <= now <= deadline
            _, created = AssignmentTask.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "question": f"Submit your {title.lower()} according to the guidelines.",
                    "description": f"This task covers key topics related to {title.lower()}.",
                    "instructions": "Upload a PDF or Word document. Max 25 MB.",
                    "upload_open_at": open_at,
                    "deadline_at": deadline,
                    "late_policy": policy,
                    "reminder_offsets": [1440, 60],
                    "is_open": is_open,
                    "is_closed": now > deadline and policy == "STRICT",
                    "created_by": creator,
                },
            )
            if created:
                count += 1
        self.stdout.write(f"  {count} new assignment tasks created ({len(task_specs)} total).")

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    def _seed_documents(self, groups: list[ClassGroup], uploader: User) -> None:
        doc_specs = [
            (0, "Module 1 Slides", "SLIDES", "GROUP", "slides_module1.pdf"),
            (0, "Admin Review Report Q1", "REPORT", "STAFF_ONLY", "review_q1.pdf"),
            (1, "Compliance Training Guide", "GUIDE", "GROUP", "compliance_guide.pdf"),
            (2, "Leadership Reference Manual", "REFERENCE", "PUBLIC_TO_CLASS", "leadership_ref.pdf"),
            (3, "Practitioner Feedback Template", "TEMPLATE", "GROUP", "feedback_template.docx"),
        ]
        count = 0
        for group_idx, title, doc_type, visibility, file_name in doc_specs:
            group = groups[group_idx]
            _, created = Document.objects.update_or_create(
                group=group,
                title=title,
                defaults={
                    "file_url": f"demo/{file_name}",
                    "file_name": file_name,
                    "file_type": "application/pdf" if file_name.endswith(".pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "file_size": 512_000,
                    "doc_type": doc_type,
                    "visibility": visibility,
                    "allowed_user_ids": [],
                    "uploaded_by": uploader,
                },
            )
            if created:
                count += 1
        self.stdout.write(f"  {count} new documents created ({len(doc_specs)} total).")

    # ------------------------------------------------------------------
    # Participant Shared Docs
    # ------------------------------------------------------------------

    def _seed_shared_docs(
        self, groups: list[ClassGroup], participants: list[User]
    ) -> None:
        # Grant upload permissions to one participant per group (idempotent)
        uploaders = [
            (participants[0], groups[0]),   # p1 → Batch Alpha
            (participants[6], groups[1]),   # p7 → Batch Beta
            (participants[12], groups[2]),  # p13 → Batch Gamma
            (participants[18], groups[3]),  # p19 → Batch Delta
            (participants[5], groups[0]),   # p6 → Batch Alpha (second uploader)
        ]
        for user, group in uploaders:
            ParticipantUploadPermission.objects.get_or_create(
                user=user,
                group=group,
                defaults={"granted_by": None},
            )

        shared_specs = [
            (participants[0], groups[0], "My Safety Notes"),
            (participants[6], groups[1], "Risk Checklist Draft"),
            (participants[12], groups[2], "Leadership Reflection"),
            (participants[18], groups[3], "Practitioner Summary"),
            (participants[5], groups[0], "Team Process Observations"),
        ]
        count = 0
        for uploader, group, title in shared_specs:
            _, created = ParticipantSharedDoc.objects.get_or_create(
                uploaded_by=uploader,
                group=group,
                title=title,
                defaults={
                    "file_url": f"demo/shared_{uploader.email.split('@')[0]}_{title.replace(' ', '_').lower()}.pdf",
                    "file_name": f"{title.replace(' ', '_').lower()}.pdf",
                    "file_type": "application/pdf",
                    "file_size": 204_800,
                    "suggested_visibility": "GROUP",
                    "suggested_user_ids": [],
                    "status": "PENDING",
                },
            )
            if created:
                count += 1
        self.stdout.write(f"  {count} new shared doc submissions created ({len(shared_specs)} total).")
