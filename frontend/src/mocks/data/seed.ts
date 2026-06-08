export { usersData } from './users';
export { groupsData, groupMemberships } from './groups';
export { classesData } from './classes';
export { attendanceRecordsData, attendanceSessions, attendanceRecords } from './attendance';
export { assignmentsData } from './assignments';
export { submissionsData } from './submissions';
export { documentsData, sharedUploadsData } from './documents';
export { notificationsData } from './notifications';
export { settingsMockData } from './settings';

// Mutable auth state for mock handlers — tracks the "currently logged-in" user
export const mockAuthState = { currentUserId: 'u-admin' };
