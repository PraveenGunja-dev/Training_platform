"""
seed_class_submissions  — Creates polished, realistic-looking assignment
submission data for classes that have tasks linked to them.

Clears and rebuilds submission records for class-linked tasks so the
Class Detail → Assignment Submissions panel has beautiful demo data.

Safe to run multiple times (deletes then recreates for class-linked tasks only).
"""

from __future__ import annotations

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.assignments.models import AssignmentTask, Submission
from apps.groups.models import ClassGroup, GroupMembership

random.seed(99)


# Realistic file name templates per task type
FILE_NAMES = {
    "Safety Audit Report": [
        "{first}_{last}_Site_Hazard_Audit.pdf",
        "{first}_{last}_Safety_Audit_Report.pdf",
        "{first}_{last}_Hazard_Assessment_Final.pdf",
        "{first}_{last}_Site_Walkthrough_Report.docx",
        "{first}_{last}_Risk_Audit_Summary.pdf",
    ],
    "Emergency Procedure Write-Up": [
        "{first}_{last}_Emergency_Procedures.docx",
        "{first}_{last}_Emergency_Response_Plan.pdf",
        "{first}_{last}_Incident_Response_Steps.docx",
        "{first}_{last}_Emergency_Protocol_Draft.pdf",
        "{first}_{last}_Crisis_Procedure_Guide.docx",
    ],
    "PPE Inspection Checklist": [
        "{first}_{last}_PPE_Inspection_Form.pdf",
        "{first}_{last}_Equipment_Check_Report.pdf",
        "{first}_{last}_PPE_Compliance_Checklist.docx",
        "{first}_{last}_Workstation_PPE_Audit.pdf",
        "{first}_{last}_Safety_Gear_Inspection.pdf",
    ],
    "Incident Analysis Case Study": [
        "{first}_{last}_Case_Study_Analysis.pdf",
        "{first}_{last}_Incident_Deep_Dive.docx",
        "{first}_{last}_Corrective_Actions_Report.pdf",
        "{first}_{last}_Root_Cause_Review.pdf",
        "{first}_{last}_Incident_Case_Study_Final.docx",
    ],
    "Compliance Gap Analysis": [
        "{first}_{last}_Compliance_Gap_Report.pdf",
        "{first}_{last}_Gap_Analysis_Summary.docx",
        "{first}_{last}_Regulatory_Gap_Assessment.pdf",
        "{first}_{last}_Compliance_Risk_Matrix.xlsx",
        "{first}_{last}_Framework_Gap_Study.pdf",
    ],
    "Regulatory Summary Brief": [
        "{first}_{last}_Regulatory_Brief.pdf",
        "{first}_{last}_Regulation_Summary.docx",
        "{first}_{last}_Compliance_Overview.pdf",
        "{first}_{last}_Session2_Reg_Summary.pdf",
        "{first}_{last}_Key_Regulations_Brief.docx",
    ],
    "Audit Trail Submission": [
        "{first}_{last}_Audit_Trail_Doc.pdf",
        "{first}_{last}_Audit_Documentation.pdf",
        "{first}_{last}_Compliance_Audit_Trail.pdf",
        "{first}_{last}_Record_Trail_Submission.docx",
        "{first}_{last}_Audit_Evidence_Package.pdf",
    ],
    "GDPR Quiz & Reflection": [
        "{first}_{last}_GDPR_Quiz_Reflection.pdf",
        "{first}_{last}_Data_Privacy_Reflection.docx",
        "{first}_{last}_GDPR_Analysis_Essay.pdf",
        "{first}_{last}_Privacy_Quiz_Response.pdf",
        "{first}_{last}_GDPR_Reflection_Final.docx",
    ],
    "Leadership Style Assessment": [
        "{first}_{last}_Leadership_Assessment.pdf",
        "{first}_{last}_Leadership_Style_Report.docx",
        "{first}_{last}_Self_Assessment_Leadership.pdf",
        "{first}_{last}_LSI_Results_Analysis.pdf",
        "{first}_{last}_Leadership_Profile_Write-Up.docx",
    ],
    "Difficult Conversation Script": [
        "{first}_{last}_Difficult_Conversation_Script.docx",
        "{first}_{last}_Role_Play_Transcript.pdf",
        "{first}_{last}_Conversation_Script_Final.docx",
        "{first}_{last}_3min_Roleplay_Script.pdf",
        "{first}_{last}_Tough_Talk_Draft.docx",
    ],
    "Team Trust Charter": [
        "{first}_{last}_Team_Trust_Charter.pdf",
        "{first}_{last}_Trust_Charter_Draft.docx",
        "{first}_{last}_Team_Agreement_Charter.pdf",
        "{first}_{last}_Group_Trust_Framework.docx",
        "{first}_{last}_Project_Team_Charter.pdf",
    ],
    "System Architecture Diagram": [
        "{first}_{last}_System_Architecture.pdf",
        "{first}_{last}_Architecture_Diagram_v2.pdf",
        "{first}_{last}_System_Design_Annotated.pdf",
        "{first}_{last}_Architecture_Overview.pptx",
        "{first}_{last}_System_Diagram_Final.pdf",
    ],
    "Root Cause Analysis Report": [
        "{first}_{last}_RCA_Report.pdf",
        "{first}_{last}_Root_Cause_Analysis.docx",
        "{first}_{last}_5Whys_Fishbone_Analysis.pdf",
        "{first}_{last}_Incident_RCA_Comparison.pdf",
        "{first}_{last}_Fault_Tree_Analysis.pdf",
    ],
}

FALLBACK_FILE_NAMES = [
    "{first}_{last}_Assignment_Submission.pdf",
    "{first}_{last}_Task_Report_Final.pdf",
    "{first}_{last}_Submission_v1.docx",
    "{first}_{last}_Assignment_Response.pdf",
    "{first}_{last}_Work_Submission.pdf",
]

SUBMISSION_NOTES = [
    "Completed all five hazard observations from the site visit last Tuesday.",
    "Referenced the handbook from session two for the regulatory section.",
    "Used the template provided in class. Let me know if any changes needed.",
    "This is my second version — updated the risk ratings after peer feedback.",
    "Apologies for the slight delay. Attached the corrected file.",
    "Included an appendix with photos from the walkthrough.",
    "Cross-referenced with the ISO standard mentioned during the workshop.",
    "Happy to discuss any part of this during the next Q&A session.",
    "",
    "",
    "",  # Many submissions have no note
]

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _first_last(full_name: str):
    parts = full_name.strip().split()
    first = parts[0] if parts else "User"
    last = parts[-1] if len(parts) > 1 else "Participant"
    return first, last


def _make_filename(task_title: str, user: User) -> tuple[str, str]:
    first, last = _first_last(user.full_name)
    templates = FILE_NAMES.get(task_title, FALLBACK_FILE_NAMES)
    tpl = random.choice(templates)
    name = tpl.format(first=first, last=last)
    ext = name.rsplit(".", 1)[-1].lower()
    return name, ext


class Command(BaseCommand):
    help = "Seed polished submission data for class-linked assignment tasks."

    def handle(self, *args, **options):
        self.stdout.write("Seeding class submission demo data…\n")
        now = timezone.now()

        tasks_with_class = (
            AssignmentTask.objects
            .filter(class_obj__isnull=False)
            .select_related("group", "class_obj", "created_by")
            .order_by("group__name", "deadline_at")
        )

        if not tasks_with_class.exists():
            self.stderr.write(
                "No tasks linked to classes. Run seed_rich first, then retry."
            )
            return

        total_created = 0

        for task in tasks_with_class:
            members = list(
                User.objects.filter(
                    group_memberships__group=task.group,
                    role="PARTICIPANT",
                ).order_by("full_name")
            )
            if not members:
                continue

            # Remove old dummy submissions for this task so we can rebuild cleanly
            deleted, _ = Submission.objects.filter(task=task).delete()
            if deleted:
                self.stdout.write(f"  Cleared {deleted} old submissions for '{task.title}'")

            past_deadline = task.deadline_at < now
            open_duration = task.deadline_at - task.upload_open_at

            self.stdout.write(
                f"\n  [{task.group.name}] Class: '{task.class_obj.title}'\n"
                f"    Task: '{task.title}' | {len(members)} participants"
            )

            for idx, user in enumerate(members):
                first, last = _first_last(user.full_name)

                # Submission probability per participant
                if past_deadline:
                    roll = random.random()
                    if roll < 0.72:
                        # On-time: submitted somewhere in upload window
                        frac = random.uniform(0.15, 0.90)
                        submit_at = task.upload_open_at + timedelta(
                            seconds=int(open_duration.total_seconds() * frac)
                        )
                        sub_status = "SUBMITTED"
                    elif roll < 0.88:
                        # Late: 1–36 hours after deadline
                        submit_at = task.deadline_at + timedelta(
                            hours=random.randint(1, 36),
                            minutes=random.randint(0, 59),
                        )
                        sub_status = "LATE_SUBMITTED"
                    else:
                        # No submission (12% skip)
                        continue
                else:
                    # Task still open: ~45% submitted so far
                    if random.random() > 0.45:
                        continue
                    frac = random.uniform(0.05, 0.60)
                    submit_at = task.upload_open_at + timedelta(
                        seconds=int(open_duration.total_seconds() * frac)
                    )
                    sub_status = "SUBMITTED"

                fname, ext = _make_filename(task.title, user)
                file_type = CONTENT_TYPES.get(ext, "application/octet-stream")
                # Realistic file sizes: pdf 80KB-4MB, docx 40KB-2MB, pptx 500KB-8MB
                size_ranges = {
                    "pdf": (80_000, 4_000_000),
                    "docx": (40_000, 2_000_000),
                    "pptx": (500_000, 8_000_000),
                    "xlsx": (20_000, 1_000_000),
                }
                lo, hi = size_ranges.get(ext, (50_000, 3_000_000))
                file_size = random.randint(lo, hi)

                note = random.choice(SUBMISSION_NOTES)

                Submission.objects.create(
                    task=task,
                    user=user,
                    version=1,
                    file_url=f"submissions/{task.group.name.lower().replace(' ', '_')}/{fname}",
                    file_name=fname,
                    file_type=file_type,
                    file_size=file_size,
                    status=sub_status,
                    submitted_at=submit_at,
                    submitted_by=user,
                    note=note,
                )
                total_created += 1
                status_icon = "[OK]" if sub_status == "SUBMITTED" else "[LATE]"
                self.stdout.write(
                    f"    {status_icon}  {user.full_name:<22}  {fname}"
                )

        self.stdout.write(
            self.style.SUCCESS(f"\nDone -- {total_created} submissions created across {tasks_with_class.count()} class-linked tasks.")
        )
