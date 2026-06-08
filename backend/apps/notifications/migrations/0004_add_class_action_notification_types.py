from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0003_alter_notification_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='type',
            field=models.CharField(
                choices=[
                    ('DEADLINE_REMINDER', 'Deadline Reminder'),
                    ('TASK_OPENED', 'Task Opened'),
                    ('SHARED_DOC_RESULT', 'Shared Doc Result'),
                    ('CLASS_SCHEDULED', 'Class Scheduled'),
                    ('CLASS_STARTING_SOON', 'Class Starting Soon'),
                    ('CLASS_RESCHEDULED', 'Class Rescheduled'),
                    ('CLASS_DOCUMENT_ADDED', 'Class Document Added'),
                    ('CLASS_TASK_ASSIGNED', 'Task Assigned to Class'),
                    ('ATTENDANCE_SESSION_STARTED', 'Attendance Session Started'),
                    ('ATTENDANCE_SESSION_ENDED', 'Attendance Session Ended'),
                    ('ATTENDANCE_CLOSING_SOON', 'Attendance Closing Soon'),
                    ('GROUP_ADDED', 'Added to Group'),
                ],
                max_length=40,
            ),
        ),
    ]
