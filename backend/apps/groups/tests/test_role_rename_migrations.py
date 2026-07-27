"""Regression coverage for the reversible Task 02 role/model migrations."""

from django.contrib.admin.models import ADDITION, LogEntry
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class RoleRenameMigrationTests(TransactionTestCase):
    """Exercise the four Task 02 migrations against their historical states."""

    migrate_from = {
        "accounts": "0008_user_photo_binary",
        "groups": "0005_add_subgroupmembership_user_index",
        "common": "0004_systemsettings_drift_threshold",
        "notifications": "0010_alter_notification_type",
    }

    def _targets(self, overrides):
        executor = MigrationExecutor(connection)
        targets = dict(executor.loader.graph.leaf_nodes())
        targets.update(overrides)
        return sorted(targets.items())

    def setUp(self):
        super().setUp()
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self._targets(self.migrate_from))
        self.old_apps = self.executor.loader.project_state(
            self._targets(self.migrate_from)
        ).apps

    def tearDown(self):
        # Restore the test database to the current migration heads for later tests.
        MigrationExecutor(connection).migrate(self._targets({}))
        super().tearDown()

    def test_role_group_setting_and_notification_migrations_round_trip(self):
        User = self.old_apps.get_model("accounts", "User")
        ClassGroup = self.old_apps.get_model("groups", "ClassGroup")
        GroupInstructor = self.old_apps.get_model("groups", "GroupInstructor")
        GroupAdmin = self.old_apps.get_model("groups", "GroupAdmin")
        SystemSettings = self.old_apps.get_model("common", "SystemSettings")
        Notification = self.old_apps.get_model("notifications", "Notification")

        actor = User.objects.create(email="actor@example.test", full_name="Actor", role="ADMIN")
        old_admin = User.objects.create(email="lead@example.test", full_name="Lead", role="GROUP_ADMIN")
        first_instructor = User.objects.create(email="sub1@example.test", full_name="Sub One", role="INSTRUCTOR")
        second_instructor = User.objects.create(email="sub2@example.test", full_name="Sub Two", role="INSTRUCTOR")
        first_group = ClassGroup.objects.create(name="First", created_by=actor)
        second_group = ClassGroup.objects.create(name="Second", created_by=actor)
        GroupInstructor.objects.create(group=first_group, instructor=first_instructor, assigned_by=actor)
        GroupInstructor.objects.create(group=second_group, instructor=first_instructor, assigned_by=actor)
        GroupInstructor.objects.create(group=first_group, instructor=second_instructor, assigned_by=actor)
        GroupAdmin.objects.create(group=first_group, admin=old_admin, assigned_by=actor)
        # Simulate the content types and default permissions present before this rename.
        ContentType.objects.filter(
            app_label="groups", model__in=("groupinstructor", "groupadmin", "groupsubmentor", "groupleadmentor")
        ).delete()
        old_sub_mentor_content_type = ContentType.objects.create(
            app_label="groups", model="groupinstructor"
        )
        old_lead_mentor_content_type = ContentType.objects.create(
            app_label="groups", model="groupadmin"
        )
        old_permission_ids = {}
        for content_type, model_name in (
            (old_sub_mentor_content_type, "groupinstructor"),
            (old_lead_mentor_content_type, "groupadmin"),
        ):
            old_permission_ids[model_name] = {
                Permission.objects.create(
                    content_type=content_type,
                    codename=f"{action}_{model_name}",
                    name=f"Can {action} {model_name.replace('group', 'group ')}",
                ).pk
                for action in ("add", "change", "delete", "view")
            }
        LogEntry.objects.create(
            user_id=actor.pk,
            content_type=old_sub_mentor_content_type,
            object_id=str(first_group.pk),
            object_repr="Historic GroupInstructor assignment",
            action_flag=ADDITION,
            change_message="Created before role rename",
        )
        SystemSettings.objects.create(pk=1, instructors_can_view_all_classes=True)
        SystemSettings.objects.create(pk=2, instructors_can_view_all_classes=False)
        Notification.objects.create(
            user=first_instructor,
            type="CO_INSTRUCTOR_ADDED",
            title="Instructor added by Group Admin",
            body="Instructor can open this class.",
            link="/training/instructor/classes/first/",
            dedupe_key="historic-co-instructor",
            sent_at=timezone.now(),
            payload={"new_instructor_id": str(second_instructor.pk), "nested": ["Instructor"]},
        )
        Notification.objects.create(
            user=first_instructor,
            type="CO_INSTRUCTOR_ADDED",
            title="Sub-Mentor already present",
            body="Lead Mentor already present.",
            link="/training/sub-mentor/classes/already/",
            dedupe_key="canonical-before-migration",
            sent_at=timezone.now(),
            payload={"new_sub_mentor_id": str(second_instructor.pk)},
        )
        Notification.objects.create(
            user=old_admin,
            type="GROUP_ADMIN_ASSIGNED",
            title="Group Admin assigned",
            body="Group Admin assignment",
            link="/training/group-admin/groups/first/",
            dedupe_key="historic-group-admin",
            sent_at=timezone.now(),
            payload={},
        )

        migrate_to = {
            "accounts": "0009_rename_roles_to_mentors",
            "groups": "0007_rename_mentor_content_types_and_permissions",
            "common": "0005_rename_sub_mentor_visibility_setting",
            "notifications": "0011_rename_mentor_notification_types",
        }
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self._targets(migrate_to))
        new_apps = self.executor.loader.project_state(self._targets(migrate_to)).apps

        NewUser = new_apps.get_model("accounts", "User")
        GroupSubMentor = new_apps.get_model("groups", "GroupSubMentor")
        GroupLeadMentor = new_apps.get_model("groups", "GroupLeadMentor")
        NewSettings = new_apps.get_model("common", "SystemSettings")
        NewNotification = new_apps.get_model("notifications", "Notification")
        self.assertTrue(ContentType.objects.filter(app_label="groups", model="groupsubmentor").exists())
        self.assertTrue(ContentType.objects.filter(app_label="groups", model="groupleadmentor").exists())
        self.assertFalse(ContentType.objects.filter(app_label="groups", model="groupinstructor").exists())
        self.assertFalse(ContentType.objects.filter(app_label="groups", model="groupadmin").exists())
        new_sub_mentor_content_type = ContentType.objects.get(
            app_label="groups", model="groupsubmentor"
        )
        new_lead_mentor_content_type = ContentType.objects.get(
            app_label="groups", model="groupleadmentor"
        )
        self.assertEqual(new_sub_mentor_content_type.pk, old_sub_mentor_content_type.pk)
        self.assertEqual(new_lead_mentor_content_type.pk, old_lead_mentor_content_type.pk)
        self.assertEqual(
            set(
                Permission.objects.filter(content_type=new_sub_mentor_content_type).values_list(
                    "pk", flat=True
                )
            ),
            old_permission_ids["groupinstructor"],
        )
        self.assertEqual(
            set(
                Permission.objects.filter(content_type=new_lead_mentor_content_type).values_list(
                    "pk", flat=True
                )
            ),
            old_permission_ids["groupadmin"],
        )
        self.assertEqual(
            LogEntry.objects.get(object_repr="Historic GroupInstructor assignment").content_type_id,
            new_sub_mentor_content_type.pk,
        )
        self.assertEqual(
            {
                permission.codename
                for permission in Permission.objects.filter(
                    content_type=new_sub_mentor_content_type
                )
            },
            {f"{action}_groupsubmentor" for action in ("add", "change", "delete", "view")},
        )
        self.assertEqual(
            {
                permission.codename
                for permission in Permission.objects.filter(
                    content_type=new_lead_mentor_content_type
                )
            },
            {f"{action}_groupleadmentor" for action in ("add", "change", "delete", "view")},
        )
        self.assertEqual(
            set(
                Permission.objects.filter(content_type=new_sub_mentor_content_type).values_list(
                    "name", flat=True
                )
            ),
            {f"Can {action} group sub-mentor" for action in ("add", "change", "delete", "view")},
        )
        self.assertEqual(
            set(
                Permission.objects.filter(content_type=new_lead_mentor_content_type).values_list(
                    "name", flat=True
                )
            ),
            {f"Can {action} group lead mentor" for action in ("add", "change", "delete", "view")},
        )
        self.assertEqual(NewUser.objects.get(pk=old_admin.pk).role, "LEAD_MENTOR")
        self.assertEqual(NewUser.objects.filter(role="SUB_MENTOR").count(), 2)
        self.assertEqual(GroupSubMentor.objects.count(), 3)
        self.assertEqual(GroupSubMentor.objects.filter(sub_mentor_id=first_instructor.pk).count(), 2)
        self.assertEqual(GroupSubMentor.objects.filter(group_id=first_group.pk).count(), 2)
        self.assertEqual(GroupLeadMentor.objects.get(group_id=first_group.pk).lead_mentor_id, old_admin.pk)
        self.assertEqual(
            list(NewSettings.objects.order_by("pk").values_list("sub_mentors_can_view_all_classes", flat=True)),
            [True, False],
        )
        migrated_notification = NewNotification.objects.get(dedupe_key="historic-co-instructor")
        self.assertEqual(migrated_notification.type, "CO_SUB_MENTOR_ADDED")
        self.assertEqual(migrated_notification.link, "/training/sub-mentor/classes/first/")
        self.assertIn("Sub-Mentor", migrated_notification.title)
        self.assertIn("Lead Mentor", migrated_notification.title)
        self.assertEqual(migrated_notification.payload["new_sub_mentor_id"], str(second_instructor.pk))
        self.assertEqual(NewNotification.objects.get(dedupe_key="historic-group-admin").type, "LEAD_MENTOR_ASSIGNED")
        canonical = NewNotification.objects.get(dedupe_key="canonical-before-migration")
        self.assertEqual(canonical.title, "Sub-Mentor already present")
        self.assertEqual(canonical.body, "Lead Mentor already present.")
        self.assertEqual(canonical.link, "/training/sub-mentor/classes/already/")
        self.assertEqual(canonical.payload["new_sub_mentor_id"], str(second_instructor.pk))

        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self._targets(self.migrate_from))
        restored_apps = self.executor.loader.project_state(self._targets(self.migrate_from)).apps
        RestoredUser = restored_apps.get_model("accounts", "User")
        RestoredInstructor = restored_apps.get_model("groups", "GroupInstructor")
        RestoredAdmin = restored_apps.get_model("groups", "GroupAdmin")
        RestoredSettings = restored_apps.get_model("common", "SystemSettings")
        RestoredNotification = restored_apps.get_model("notifications", "Notification")
        restored_sub_mentor_content_type = ContentType.objects.get(
            app_label="groups", model="groupinstructor"
        )
        restored_lead_mentor_content_type = ContentType.objects.get(
            app_label="groups", model="groupadmin"
        )
        self.assertEqual(restored_sub_mentor_content_type.pk, old_sub_mentor_content_type.pk)
        self.assertEqual(restored_lead_mentor_content_type.pk, old_lead_mentor_content_type.pk)
        self.assertEqual(
            LogEntry.objects.get(object_repr="Historic GroupInstructor assignment").content_type_id,
            restored_sub_mentor_content_type.pk,
        )
        self.assertEqual(
            {
                permission.codename
                for permission in Permission.objects.filter(
                    content_type=restored_sub_mentor_content_type
                )
            },
            {f"{action}_groupinstructor" for action in ("add", "change", "delete", "view")},
        )
        self.assertEqual(
            {
                permission.codename
                for permission in Permission.objects.filter(
                    content_type=restored_lead_mentor_content_type
                )
            },
            {f"{action}_groupadmin" for action in ("add", "change", "delete", "view")},
        )
        self.assertEqual(RestoredUser.objects.get(pk=old_admin.pk).role, "GROUP_ADMIN")
        self.assertEqual(RestoredUser.objects.filter(role="INSTRUCTOR").count(), 2)
        self.assertEqual(RestoredInstructor.objects.count(), 3)
        self.assertEqual(RestoredInstructor.objects.filter(instructor_id=first_instructor.pk).count(), 2)
        self.assertEqual(RestoredAdmin.objects.get(group_id=first_group.pk).admin_id, old_admin.pk)
        self.assertEqual(
            list(RestoredSettings.objects.order_by("pk").values_list("instructors_can_view_all_classes", flat=True)),
            [True, False],
        )
        restored_notification = RestoredNotification.objects.get(dedupe_key="historic-co-instructor")
        self.assertEqual(restored_notification.type, "CO_INSTRUCTOR_ADDED")
        self.assertEqual(restored_notification.link, "/training/instructor/classes/first/")
        self.assertEqual(restored_notification.payload["new_instructor_id"], str(second_instructor.pk))
        self.assertEqual(RestoredNotification.objects.get(dedupe_key="historic-group-admin").type, "GROUP_ADMIN_ASSIGNED")
        restored_canonical = RestoredNotification.objects.get(dedupe_key="canonical-before-migration")
        self.assertEqual(restored_canonical.type, "CO_INSTRUCTOR_ADDED")
        self.assertEqual(restored_canonical.title, "Sub-Mentor already present")
        self.assertEqual(restored_canonical.body, "Lead Mentor already present.")
        self.assertEqual(restored_canonical.link, "/training/sub-mentor/classes/already/")
        self.assertEqual(restored_canonical.payload, {"new_sub_mentor_id": str(second_instructor.pk)})
