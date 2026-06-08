"""
seed_rich  — fills the database with realistic production-like data.

Creates (on top of whatever seed_demo already laid down):
  - Rich class schedule: past (with completed attendance), today (morning
    completed + afternoon ongoing + evening upcoming), tomorrow (2 per group),
    day-after-tomorrow (1 per group), next-week (1 per group)
  - Attendance sessions with realistic present/absent records for all past
    and completed-today classes
  - Submissions: mix of on-time, late, and pending across all tasks
  - Notifications: inbox entries for every participant
  - Audit log entries for all major actions

Safe to run multiple times (uses get_or_create / update_or_create throughout).
"""

from __future__ import annotations

import random
import uuid
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.assignments.models import AssignmentTask, Submission
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.audit.models import AuditLog
from apps.groups.models import ClassGroup, GroupMembership
from apps.notifications.models import Notification
from apps.scheduling.models import Class

random.seed(42)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PARTICIPANT_NAMES = [
    "Arjun Sharma", "Priya Patel", "Rahul Mehta", "Sunita Verma", "Kiran Rao",
    "Deepak Nair", "Anjali Singh", "Vikram Gupta", "Pooja Iyer", "Suresh Kumar",
    "Neha Joshi", "Amit Desai", "Kavya Reddy", "Rajesh Pillai", "Meena Agarwal",
    "Sanjay Malhotra", "Divya Chandra", "Manoj Tiwari", "Lakshmi Bhat", "Ravi Saxena",
    "Sneha Kulkarni", "Tarun Pandey", "Usha Iyengar", "Vijay Dubey", "Yasmin Khan",
]

TASK_TEMPLATES = {
    "Batch Alpha": [
        ("Safety Audit Report",           "Document at least 5 hazards observed during the site walkthrough.",              -20),
        ("Emergency Procedure Write-Up",  "Write step-by-step emergency procedures for your assigned scenario.",            -12),
        ("PPE Inspection Checklist",      "Complete the PPE checklist for your workstation and submit with photos.",        -5),
        ("Incident Analysis Case Study",  "Analyse the provided incident case and propose corrective actions.",              6),
        ("Safety Culture Essay",          "500-word reflection on embedding safety behaviours in your team.",               14),
    ],
    "Batch Beta": [
        ("Compliance Gap Analysis",       "Identify gaps in the current compliance framework and rate risk severity.",      -18),
        ("Regulatory Summary Brief",      "Summarise the three regulations discussed in session two.",                      -10),
        ("Audit Trail Submission",        "Submit your completed audit trail documentation for peer review.",               -3),
        ("Whistleblower Scenario Report", "Respond to the given whistleblower scenario with recommended actions.",           8),
        ("GDPR Quiz & Reflection",        "Complete the GDPR quiz and write a 300-word reflection on your results.",       16),
    ],
    "Batch Gamma": [
        ("Leadership Style Assessment",   "Take the assessment and write a 400-word analysis of your results.",            -22),
        ("Difficult Conversation Script", "Draft and record a 3-minute role-play of a difficult conversation.",            -11),
        ("Team Trust Charter",            "Create a team trust charter for your assigned project group.",                   -4),
        ("Change Management Plan",        "Develop a one-page change management plan for the given scenario.",              7),
        ("Leadership Development Plan",   "Personal 90-day leadership development plan with measurable goals.",            15),
    ],
    "Batch Delta": [
        ("System Architecture Diagram",   "Draw and annotate the system diagram covered in session two.",                  -19),
        ("Root Cause Analysis Report",    "Apply three RCA methods to the provided incident and compare results.",         -9),
        ("Cross-Functional Exercise Log", "Document your role and outcomes from the tabletop simulation.",                 -2),
        ("Peer Review Submission",        "Submit your peer review with structured feedback for two classmates.",           9),
        ("Practitioner Capstone",         "Final capstone submission: 1500-word practitioner assessment.",                 18),
    ],
}

CLASS_TOPICS = {
    "Batch Alpha": [
        ("Safety Induction Day 1",        "Workplace safety fundamentals and emergency procedures."),
        ("Hazard Identification Workshop", "Practical hazard spotting and risk rating exercise."),
        ("PPE Compliance Training",        "Correct usage and maintenance of personal protective equipment."),
        ("Emergency Response Drill",       "Live drill for fire, chemical spill, and medical emergencies."),
        ("Safety Culture Review",          "Embedding safety behaviours into daily work routines."),
        ("Incident Reporting Masterclass", "How to file, escalate and learn from incident reports."),
        ("Safety Audit Preparation",       "Step-by-step guide to preparing for external safety audits."),
        ("Module Wrap-Up & Q&A",           "Final review, open Q&A, and cohort feedback session."),
    ],
    "Batch Beta": [
        ("Compliance Fundamentals",        "Core regulatory requirements every employee must know."),
        ("Risk Assessment Clinic",         "Hands-on risk matrix creation and scoring."),
        ("Regulatory Framework Overview",  "Survey of applicable laws, standards, and codes of practice."),
        ("Audit Trail Best Practices",     "Maintaining audit-ready documentation at all times."),
        ("Whistleblower Policy Briefing",  "Reporting channels, protections, and escalation paths."),
        ("Mock Compliance Audit",          "Simulated regulator visit with debrief and scoring."),
        ("Data Privacy & GDPR Refresher",  "Key obligations under data-protection regulations."),
        ("Compliance Closure Session",     "Group reflection, action items, and next-step planning."),
    ],
    "Batch Gamma": [
        ("Leadership Essentials",          "Core leadership styles and when to apply each."),
        ("Difficult Conversations Lab",    "Role-play practice for challenging workplace discussions."),
        ("Team Dynamics & Trust",          "Building psychological safety in high-performing teams."),
        ("Strategy Alignment Workshop",    "Cascading organisational goals to team OKRs."),
        ("Change Management Bootcamp",     "Tools and frameworks for leading change effectively."),
        ("Executive Communication",        "Structuring presentations and board-level communication."),
        ("Coaching & Feedback Skills",     "Giving growth-oriented feedback and coaching conversations."),
        ("Leadership Capstone",            "Presentations of personal leadership development plans."),
    ],
    "Batch Delta": [
        ("Advanced Practitioner Intro",    "Overview of the advanced practitioner certification path."),
        ("Technical Deep-Dive: Systems",   "System architecture, dependencies, and failure analysis."),
        ("Case Study: Major Incident",     "Detailed breakdown of a real-world major incident."),
        ("Root Cause Analysis Methods",    "5-Whys, Fishbone, and fault-tree analysis in practice."),
        ("Practitioner Assessment Prep",   "Practice exam and marking-criteria walkthrough."),
        ("Cross-Functional Simulation",    "Multi-team incident response tabletop exercise."),
        ("Peer Review & Critique",         "Structured peer assessment of practitioner submissions."),
        ("Certification Ceremony & Wrap",  "Award ceremony, final feedback, and programme close."),
    ],
}


def _hhmm(dt) -> str:
    return dt.strftime("%H:%M")


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Seed rich realistic data: classes, attendance, submissions, notifications."

    def handle(self, *args, **options):
        self.stdout.write("Seeding rich data …\n")
        now = timezone.now()

        # Fetch users seeded by seed_demo
        admins = list(User.objects.filter(role="ADMIN").order_by("email"))
        participants = list(User.objects.filter(role="PARTICIPANT").order_by("email"))
        groups = list(ClassGroup.objects.filter(is_archived=False).exclude(name="Group_testing_one"))

        if not admins or not participants or not groups:
            self.stderr.write("Run seed_demo first, then seed_rich.")
            return

        # Give participants real-looking names
        self._rename_participants(participants)

        creator = admins[0]
        group_members: dict[str, list[User]] = {}
        for g in groups:
            group_members[str(g.id)] = list(
                User.objects.filter(group_memberships__group=g, role="PARTICIPANT")
            )

        # 1. Build class schedule
        classes_by_group = self._seed_classes(groups, creator, now)

        # 2. Seed assignment tasks (past-deadline + open), linking some to classes
        self._seed_tasks(groups, creator, now, classes_by_group)

        # 3. Attendance for past / completed classes
        self._seed_attendance(classes_by_group, group_members, admins[1], now)

        # 4. Submissions
        self._seed_submissions(groups, group_members, now)

        # 4. Notifications
        self._seed_notifications(participants, groups, classes_by_group, now)

        # 5. Audit log
        self._seed_audit(admins, groups, now)

        self.stdout.write(self.style.SUCCESS("\nRich seed complete."))

    # ------------------------------------------------------------------
    # Participants: give real names
    # ------------------------------------------------------------------

    def _rename_participants(self, participants):
        for i, p in enumerate(participants):
            name = PARTICIPANT_NAMES[i % len(PARTICIPANT_NAMES)]
            if p.full_name != name:
                p.full_name = name
                p.save(update_fields=["full_name"])
        self.stdout.write(f"  Renamed {len(participants)} participants.")

    # ------------------------------------------------------------------
    # Assignment Tasks
    # ------------------------------------------------------------------

    def _seed_tasks(self, groups, creator, now, classes_by_group=None):
        total = 0
        linked = 0
        for g in groups:
            templates = TASK_TEMPLATES.get(g.name, TASK_TEMPLATES["Batch Alpha"])
            # Pick the first 2 completed classes for this group to link tasks to
            group_classes = (classes_by_group or {}).get(str(g.id), [])
            completed = [c for c in group_classes if c.status_cached == "COMPLETED"]
            for idx, (title, desc, day_offset) in enumerate(templates):
                open_at    = now + timedelta(days=day_offset - 7)
                deadline   = now + timedelta(days=day_offset)
                is_open    = deadline > now
                is_closed  = deadline <= now
                # Link first 2 tasks to completed classes (if available)
                class_obj = completed[idx] if idx < len(completed) else None
                task, created = AssignmentTask.objects.get_or_create(
                    group=g,
                    title=title,
                    defaults=dict(
                        question=desc,
                        upload_open_at=open_at,
                        deadline_at=deadline,
                        is_open=is_open,
                        is_closed=is_closed,
                        created_by=creator,
                        class_obj=class_obj,
                    ),
                )
                if not created and class_obj and task.class_obj_id is None:
                    task.class_obj = class_obj
                    task.save(update_fields=["class_obj"])
                    linked += 1
                if created:
                    total += 1
        self.stdout.write(f"  {total} assignment tasks seeded, {linked} newly linked to classes.")

    # ------------------------------------------------------------------
    # Classes
    # ------------------------------------------------------------------

    def _seed_classes(self, groups, creator, now):
        """
        Returns dict: group_id → list of Class objects (chronological).
        Schedule per group (8 topics each):
          - 4 past weeks (one each week, COMPLETED)
          - Yesterday          (COMPLETED)
          - Today 09:00-11:00  (COMPLETED — morning wrap-up)
          - Today now-1h → now+1h  (ONGOING — current session)
          - Today 18:00-20:00  (UPCOMING — evening)
          - Tomorrow 09:00-11:00  (UPCOMING)
          - Tomorrow 14:00-16:00  (UPCOMING)
          - Day-after-tomorrow 10:00-12:00  (UPCOMING)
        """
        today = now.date()
        result: dict[str, list[Class]] = {}

        for g in groups:
            topics = CLASS_TOPICS.get(g.name, CLASS_TOPICS["Batch Alpha"])
            cls_list = []

            def make_class(title, desc, start_dt, end_dt, status_override=None):
                att_open  = start_dt - timedelta(minutes=10)
                att_close = start_dt + timedelta(minutes=30)
                cls, _ = Class.objects.update_or_create(
                    group=g,
                    title=title,
                    defaults=dict(
                        description=desc,
                        starts_at=start_dt,
                        ends_at=end_dt,
                        attendance_open_at=att_open,
                        attendance_close_at=att_close,
                        allow_late_attendance=False,
                        created_by=creator,
                        status_cached=status_override or "",
                    ),
                )
                if status_override:
                    cls.status_cached = status_override
                    cls.save(update_fields=["status_cached"])
                return cls

            # 4 weeks ago
            for week_offset, topic_idx in [(28, 0), (21, 1), (14, 2), (7, 3)]:
                day = today - timedelta(days=week_offset)
                s = now.replace(
                    year=day.year, month=day.month, day=day.day,
                    hour=9, minute=0, second=0, microsecond=0
                )
                cls_list.append(make_class(topics[topic_idx][0], topics[topic_idx][1],
                                           s, s + timedelta(hours=2), "COMPLETED"))

            # Yesterday
            yest = today - timedelta(days=1)
            s = now.replace(year=yest.year, month=yest.month, day=yest.day,
                            hour=10, minute=0, second=0, microsecond=0)
            cls_list.append(make_class(topics[4][0], topics[4][1],
                                       s, s + timedelta(hours=2), "COMPLETED"))

            # Today morning (COMPLETED)
            s = now.replace(hour=9, minute=0, second=0, microsecond=0)
            cls_list.append(make_class(topics[5][0], topics[5][1],
                                       s, s + timedelta(hours=2), "COMPLETED"))

            # Today ONGOING (now - 45 min → now + 45 min)
            s = now - timedelta(minutes=45)
            cls_list.append(make_class(topics[6][0], topics[6][1],
                                       s, now + timedelta(minutes=45)))

            # Today evening (UPCOMING)
            s = now.replace(hour=18, minute=0, second=0, microsecond=0)
            cls_list.append(make_class(topics[7][0], topics[7][1],
                                       s, s + timedelta(hours=2)))

            # Tomorrow x2
            tmr = today + timedelta(days=1)
            for hour, topic_idx in [(9, 0), (14, 2)]:
                s = now.replace(year=tmr.year, month=tmr.month, day=tmr.day,
                                hour=hour, minute=0, second=0, microsecond=0)
                t = topics[topic_idx % len(topics)]
                cls_list.append(make_class(f"{t[0]} (Revision)", t[1],
                                           s, s + timedelta(hours=2)))

            # Day after tomorrow
            dat = today + timedelta(days=2)
            s = now.replace(year=dat.year, month=dat.month, day=dat.day,
                            hour=10, minute=0, second=0, microsecond=0)
            t = topics[1 % len(topics)]
            cls_list.append(make_class(f"{t[0]} (Advanced)", t[1],
                                       s, s + timedelta(hours=2)))

            result[str(g.id)] = cls_list
            self.stdout.write(f"  {g.name}: {len(cls_list)} classes seeded.")

        return result

    # ------------------------------------------------------------------
    # Attendance
    # ------------------------------------------------------------------

    def _seed_attendance(self, classes_by_group, group_members, admin, now):
        total_sessions = 0
        total_records = 0

        for gid, cls_list in classes_by_group.items():
            members = group_members.get(gid, [])
            if not members:
                continue

            for cls in cls_list:
                # Only create sessions for COMPLETED classes and the ongoing one
                if cls.status_cached == "COMPLETED":
                    session, created = AttendanceSession.objects.get_or_create(
                        class_obj=cls,
                        defaults=dict(
                            started_at=cls.starts_at,
                            started_by=admin,
                            ended_at=cls.ends_at,
                            ended_by=admin,
                            status="ENDED",
                            duration_minutes=int((cls.ends_at - cls.starts_at).total_seconds() / 60),
                        ),
                    )
                    if created:
                        total_sessions += 1
                        # 70-95% attendance rate
                        attendance_rate = random.uniform(0.70, 0.95)
                        attendees = random.sample(members, k=int(len(members) * attendance_rate))
                        for user in attendees:
                            _, rec_created = AttendanceRecord.objects.get_or_create(
                                session=session,
                                user=user,
                                defaults=dict(
                                    marked_at=cls.starts_at + timedelta(minutes=random.randint(0, 20)),
                                    status="PRESENT",
                                ),
                            )
                            if rec_created:
                                total_records += 1

                elif cls.status_cached == "" and cls.ends_at > now:
                    # Ongoing — create an ACTIVE session
                    session, created = AttendanceSession.objects.get_or_create(
                        class_obj=cls,
                        defaults=dict(
                            started_at=cls.starts_at,
                            started_by=admin,
                            ended_at=None,
                            ended_by=None,
                            status="ACTIVE",
                            duration_minutes=None,
                            scheduled_end_at=cls.ends_at,
                        ),
                    )
                    if created:
                        total_sessions += 1
                        # ~50% already marked for the live session
                        attendees = random.sample(members, k=max(1, int(len(members) * 0.5)))
                        for user in attendees:
                            _, rec_created = AttendanceRecord.objects.get_or_create(
                                session=session,
                                user=user,
                                defaults=dict(
                                    marked_at=now - timedelta(minutes=random.randint(1, 30)),
                                    status="PRESENT",
                                ),
                            )
                            if rec_created:
                                total_records += 1

        self.stdout.write(
            f"  {total_sessions} attendance sessions + {total_records} records seeded."
        )

    # ------------------------------------------------------------------
    # Submissions
    # ------------------------------------------------------------------

    def _seed_submissions(self, groups, group_members, now):
        total = 0
        for g in groups:
            members = group_members.get(str(g.id), [])
            tasks = AssignmentTask.objects.filter(group=g)
            for task in tasks:
                past_deadline = task.deadline_at < now
                for user in members:
                    # Skip if already submitted
                    if Submission.objects.filter(task=task, user=user).exists():
                        continue

                    if past_deadline:
                        roll = random.random()
                        if roll < 0.65:          # 65% submitted on time
                            submit_at = task.upload_open_at + timedelta(
                                seconds=random.randint(3600, int((task.deadline_at - task.upload_open_at).total_seconds() * 0.9))
                            )
                            status = "SUBMITTED"
                        elif roll < 0.80:        # 15% late
                            submit_at = task.deadline_at + timedelta(hours=random.randint(1, 48))
                            status = "LATE_SUBMITTED"
                        else:
                            continue             # 20% no submission
                    else:
                        # Open task — 35% submitted so far
                        if random.random() > 0.35:
                            continue
                        submit_at = task.upload_open_at + timedelta(
                            seconds=random.randint(1800, 86400)
                        )
                        status = "SUBMITTED"

                    ext = random.choice(["pdf", "docx", "pptx"])
                    fname = f"{task.title.replace(' ', '_').lower()}_{user.email.split('@')[0]}.{ext}"
                    Submission.objects.create(
                        task=task,
                        user=user,
                        version=1,
                        file_url=f"submissions/{fname}",
                        file_name=fname,
                        file_type="application/pdf" if ext == "pdf" else f"application/{ext}",
                        file_size=random.randint(100_000, 5_000_000),
                        status=status,
                        submitted_at=submit_at,
                        submitted_by=user,
                        note="",
                    )
                    total += 1
        self.stdout.write(f"  {total} submissions seeded.")

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    def _seed_notifications(self, participants, groups, classes_by_group, now):
        from apps.assignments.models import AssignmentTask
        from apps.groups.models import GroupMembership

        total = 0
        notif_templates = [
            ("TASK_OPENED",                "New Task Available",   "A new assignment has been opened for your group."),
            ("CLASS_SCHEDULED",            "Class Scheduled",      "A new class session has been added to your calendar."),
            ("DEADLINE_REMINDER",          "Deadline Approaching", "Your assignment deadline is coming up soon."),
            ("CLASS_STARTING_SOON",        "Class Starting Soon",  "Your class begins in 10 minutes. Please be ready."),
            ("SHARED_DOC_RESULT",          "Upload Decision",      "Your shared document submission has been reviewed."),
            ("GROUP_ADDED",                "Added to Group",       "You have been added to a new training group."),
            ("ATTENDANCE_SESSION_STARTED", "Attendance Open",      "Attendance is now open for your current class."),
        ]

        for p in participants:
            # Resolve real class and task IDs for this participant's groups
            p_group_ids = list(GroupMembership.objects.filter(user=p).values_list("group_id", flat=True))
            p_classes = []
            p_task_ids = []
            for gid in p_group_ids:
                p_classes.extend(classes_by_group.get(str(gid), []))
                p_task_ids.extend(
                    AssignmentTask.objects.filter(group_id=gid).values_list("id", flat=True)
                )

            count = random.randint(4, 8)
            sample = random.choices(notif_templates, k=count)
            for notif_type, title, body in sample:
                if notif_type in ("CLASS_SCHEDULED", "CLASS_STARTING_SOON", "ATTENDANCE_SESSION_STARTED"):
                    cls = random.choice(p_classes) if p_classes else None
                    link = f"/me/classes/{cls.id}" if cls else "/me/calendar"
                elif notif_type in ("TASK_OPENED", "DEADLINE_REMINDER"):
                    task_id = random.choice(p_task_ids) if p_task_ids else None
                    link = f"/me/tasks/{task_id}" if task_id else "/me/tasks"
                elif notif_type == "SHARED_DOC_RESULT":
                    link = "/me/documents"
                else:
                    link = "/me/dashboard"

                sent_at = now - timedelta(hours=random.randint(1, 72))
                read_at = sent_at + timedelta(hours=random.randint(1, 6)) if random.random() > 0.4 else None
                key = f"{p.id}-{notif_type}-{sent_at.date()}-{random.randint(0,9999)}"
                Notification.objects.get_or_create(
                    dedupe_key=key,
                    defaults=dict(
                        user=p,
                        type=notif_type,
                        channel="IN_APP",
                        title=title,
                        body=body,
                        link=link,
                        status="SENT",
                        read_at=read_at,
                        sent_at=sent_at,
                        payload={},
                    ),
                )
                total += 1

        self.stdout.write(f"  {total} notifications seeded.")

    # ------------------------------------------------------------------
    # Audit log
    # ------------------------------------------------------------------

    def _seed_audit(self, admins, groups, now):
        actions = [
            ("user.invited",        "User"),
            ("group.created",       "ClassGroup"),
            ("class.created",       "Class"),
            ("class.updated",       "Class"),
            ("task.created",        "AssignmentTask"),
            ("document.uploaded",   "Document"),
            ("attendance.started",  "AttendanceSession"),
            ("attendance.ended",    "AttendanceSession"),
            ("submission.reviewed", "Submission"),
            ("shared_doc.approved", "ParticipantSharedDoc"),
            ("shared_doc.rejected", "ParticipantSharedDoc"),
            ("settings.updated",    "SystemSettings"),
        ]
        total = 0
        for i in range(40):
            admin = random.choice(admins)
            action, target_type = random.choice(actions)
            created_at = now - timedelta(hours=random.randint(1, 336))  # up to 2 weeks ago
            AuditLog.objects.create(
                actor=admin,
                action=action,
                target_type=target_type,
                target_id=str(uuid.uuid4()),
                metadata={"note": "seeded"},
                created_at=created_at,
            )
            total += 1
        self.stdout.write(f"  {total} audit log entries seeded.")
