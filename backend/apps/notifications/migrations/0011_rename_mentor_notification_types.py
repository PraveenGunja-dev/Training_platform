from django.db import migrations, models


FORWARD = {"CO_INSTRUCTOR_ADDED": "CO_SUB_MENTOR_ADDED", "CO_INSTRUCTOR_EDITED_CLASS": "CO_SUB_MENTOR_EDITED_CLASS", "GROUP_ADMIN_ASSIGNED": "LEAD_MENTOR_ASSIGNED"}
REVERSE = {value: key for key, value in FORWARD.items()}
SNAPSHOT_KEY = "__role_rename_0011_original__"


def rewrite(value, mapping):
    if isinstance(value, dict):
        return {("new_sub_mentor_id" if k == "new_instructor_id" and mapping is FORWARD else "new_instructor_id" if k == "new_sub_mentor_id" and mapping is REVERSE else k): rewrite(v, mapping) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite(v, mapping) for v in value]
    if isinstance(value, str):
        pairs = (("/instructor/", "/sub-mentor/"), ("/group-admin/", "/lead-mentor/"), ("Group Admin", "Lead Mentor"), ("Instructor", "Sub-Mentor"))
        if mapping is REVERSE:
            pairs = tuple((b, a) for a, b in pairs)
        for old, new in pairs:
            value = value.replace(old, new)
    return value


def convert_forward(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")
    before_total = Notification.objects.count()
    before_counts = {old: Notification.objects.filter(type=old).count() for old in FORWARD}
    for item in Notification.objects.all().iterator():
        if isinstance(item.payload, dict) and SNAPSHOT_KEY in item.payload:
            raise RuntimeError("Reserved notification migration snapshot key already exists.")
        payload = item.payload if isinstance(item.payload, dict) else {"value": item.payload}
        if SNAPSHOT_KEY not in payload:
            payload = dict(payload)
            payload[SNAPSHOT_KEY] = {
                "type": item.type,
                "title": item.title,
                "body": item.body,
                "link": item.link,
                "payload": item.payload,
            }
        item.type = FORWARD.get(item.type, item.type)
        item.link = rewrite(item.link, FORWARD)
        item.title = rewrite(item.title, FORWARD)
        item.body = rewrite(item.body, FORWARD)
        rewritten_payload = rewrite({key: value for key, value in payload.items() if key != SNAPSHOT_KEY}, FORWARD)
        rewritten_payload[SNAPSHOT_KEY] = payload[SNAPSHOT_KEY]
        item.payload = rewritten_payload
        item.save(update_fields=["type", "link", "title", "body", "payload"])
    after_counts = {new: Notification.objects.filter(type=new).count() for new in FORWARD.values()}
    if Notification.objects.count() != before_total or any(
        before_counts[old] != after_counts[new] for old, new in FORWARD.items()
    ):
        raise RuntimeError("Notification migration did not preserve affected row counts.")


def convert_reverse(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")
    before_total = Notification.objects.count()
    for item in Notification.objects.all().iterator():
        payload = item.payload
        snapshot = payload.get(SNAPSHOT_KEY) if isinstance(payload, dict) else None
        if isinstance(snapshot, dict):
            item.type = snapshot["type"]
            item.title = snapshot["title"]
            item.body = snapshot["body"]
            item.link = snapshot["link"]
            item.payload = snapshot["payload"]
        else:
            item.type = REVERSE.get(item.type, item.type)
            item.link = rewrite(item.link, REVERSE)
            item.title = rewrite(item.title, REVERSE)
            item.body = rewrite(item.body, REVERSE)
            item.payload = rewrite(item.payload, REVERSE)
        item.save(update_fields=["type", "title", "body", "link", "payload"])
    if Notification.objects.count() != before_total:
        raise RuntimeError("Notification reverse migration did not preserve row count.")


def forwards(apps, schema_editor):
    convert_forward(apps, schema_editor)


def backwards(apps, schema_editor):
    convert_reverse(apps, schema_editor)

class Migration(migrations.Migration):
    dependencies = [("notifications", "0010_alter_notification_type")]
    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(model_name="notification", name="type", field=models.CharField(choices=[("DEADLINE_REMINDER", "Deadline Reminder"), ("TASK_OPENED", "Task Opened"), ("SHARED_DOC_RESULT", "Shared Doc Result"), ("CLASS_SCHEDULED", "Class Scheduled"), ("CLASS_STARTING_SOON", "Class Starting Soon"), ("CLASS_RESCHEDULED", "Class Rescheduled"), ("CLASS_DOCUMENT_ADDED", "Class Document Added"), ("GROUP_DOCUMENT_ADDED", "Group Document Added"), ("CLASS_TASK_ASSIGNED", "Task Assigned to Class"), ("ATTENDANCE_SESSION_STARTED", "Attendance Session Started"), ("ATTENDANCE_SESSION_ENDED", "Attendance Session Ended"), ("ATTENDANCE_CLOSING_SOON", "Attendance Closing Soon"), ("ATTENDANCE_OVERRIDE", "Attendance Override"), ("GROUP_ADDED", "Added to Group"), ("INVITE_RESENT", "Invite Resent"), ("GROUP_ASSIGNED", "Group Assigned"), ("GROUP_UNASSIGNED", "Group Unassigned"), ("CO_SUB_MENTOR_ADDED", "Co-Sub-Mentor Added"), ("CLASS_SCHEDULED_BY_ADMIN", "Class Scheduled by Admin"), ("CLASS_CANCELLED", "Class Cancelled"), ("CO_SUB_MENTOR_EDITED_CLASS", "Co-Sub-Mentor Edited Class"), ("LEAD_MENTOR_ASSIGNED", "Lead Mentor Assigned"), ("ASSIGNMENT_CREATED_IN_GROUP", "Assignment Created in Group"), ("SUBMISSION_RECEIVED", "Submission Received"), ("DEADLINE_APPROACHING", "Deadline Approaching"), ("ATTENDANCE_SESSION_REMINDER", "Attendance Session Reminder"), ("PARTICIPANTS_ADDED_TO_GROUP", "Participants Added to Group"), ("PARTICIPANTS_REMOVED_FROM_GROUP", "Participants Removed from Group"), ("SHARED_UPLOAD_PENDING", "Shared Upload Pending"), ("SUBMISSION_REVIEWED", "Submission Reviewed")], max_length=40)),
    ]