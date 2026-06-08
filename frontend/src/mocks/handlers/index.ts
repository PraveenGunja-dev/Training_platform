import { authHandlers } from './auth';
import { usersHandlers } from './users';
import { groupsHandlers } from './groups';
import { classesHandlers } from './classes';
import { attendanceHandlers } from './attendance';
import { assignmentsHandlers } from './assignments';
import { submissionsHandlers } from './submissions';
import { documentsHandlers } from './documents';
import { dashboardHandlers } from './dashboard';
import { notificationsHandlers } from './notifications';
import { auditHandlers } from './audit';
import { settingsHandlers } from './settings';
export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...groupsHandlers,
  ...classesHandlers,
  ...attendanceHandlers,
  ...assignmentsHandlers,
  ...submissionsHandlers,
  ...documentsHandlers,
  ...dashboardHandlers,
  ...notificationsHandlers,
  ...auditHandlers,
  ...settingsHandlers,
];
