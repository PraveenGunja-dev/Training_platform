import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootRedirect } from './RootRedirect';
import { MustChangePasswordGuard } from './MustChangePasswordGuard';
import { AdminLayout, ParticipantLayout, InstructorLayout, GroupAdminLayout } from '@/components/layout/AppShell';
import { ForceChangePasswordPage } from '@/pages/auth/ForceChangePasswordPage';
import GroupAdminDashboardPage from '@/pages/group-admin/DashboardPage';
import GroupAdminSubGroupDetailPage from '@/pages/group-admin/SubGroupDetailPage';
import GroupAdminParticipantsPage from '@/pages/group-admin/ParticipantsPage';
import GroupAdminAnalyticsPage from '@/pages/group-admin/AnalyticsPage';
import GroupAdminInstructorsPage from '@/pages/group-admin/InstructorsPage';
import GroupAdminSubGroupsPage from '@/pages/group-admin/SubGroupsPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SetPasswordPage } from '@/pages/auth/SetPasswordPage';
import { ProfilePage } from '@/pages/auth/ProfilePage';
import { ForbiddenPage } from '@/pages/auth/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import AdminDashboardPage from '@/pages/admin/DashboardPage';
import AdminUsersPage from '@/pages/admin/UsersPage';
import AdminUserDetailPage from '@/pages/admin/UserDetailPage';
import AdminAuditLogPage from '@/pages/admin/AuditLogPage';
import AdminSettingsPage from '@/pages/admin/SettingsPage';
import AdminGroupsPage from '@/pages/admin/GroupsPage';
import AdminGroupDetailPage from '@/pages/admin/GroupDetailPage';
import AdminClassesPage from '@/pages/admin/ClassesPage';
import AdminClassDetailPage from '@/pages/admin/ClassDetailPage';
import AdminAssignmentsPage from '@/pages/admin/AssignmentsPage';
import AdminAssignmentDetailPage from '@/pages/admin/AssignmentDetailPage';
import AdminSubmissionsReviewPage from '@/pages/admin/SubmissionsReviewPage';
import AdminDocumentsPage from '@/pages/admin/DocumentsPage';
import AdminSharedUploadsPage from '@/pages/admin/SharedUploadsPage';
import AdminAttendancePage from '@/pages/admin/AttendancePage';
import AdminAttendanceReportPage from '@/pages/admin/AttendanceReportPage';
import AdminCalendarPage from '@/pages/admin/CalendarPage';
import AdminOrgChartPage from '@/pages/admin/OrgChartPage';
import AdminSubGroupDetailPage from '@/pages/admin/SubGroupDetailPage';
import ParticipantDashboardPage from '@/pages/me/DashboardPage';
import NotificationsPage from '@/pages/me/NotificationsPage';
import CalendarPage from '@/pages/me/CalendarPage';
import ClassDetailPage from '@/pages/me/ClassDetailPage';
import TasksPage from '@/pages/me/TasksPage';
import TaskDetailPage from '@/pages/me/TaskDetailPage';
import SubmissionsPage from '@/pages/me/SubmissionsPage';
import DocumentsPage from '@/pages/me/DocumentsPage';
import InstructorDashboardPage from '@/pages/instructor/DashboardPage';
import InstructorCalendarPage from '@/pages/instructor/CalendarPage';
import InstructorGroupsPage from '@/pages/instructor/GroupsPage';
import InstructorGroupDetailPage from '@/pages/instructor/GroupDetailPage';
import InstructorClassesPage from '@/pages/instructor/ClassesPage';
import InstructorClassDetailPage from '@/pages/instructor/ClassDetailPage';
import InstructorAttendancePage from '@/pages/instructor/AttendancePage';
import InstructorAssignmentsPage from '@/pages/instructor/AssignmentsPage';
import InstructorAssignmentDetailPage from '@/pages/instructor/AssignmentDetailPage';
import InstructorSubmissionsPage from '@/pages/instructor/SubmissionsPage';
import InstructorDocumentsPage from '@/pages/instructor/DocumentsPage';
import InstructorSharedUploadsPage from '@/pages/instructor/SharedUploadsPage';
import InstructorNotificationsPage from '@/pages/instructor/NotificationsPage';
import InstructorAttendanceReportPage from '@/pages/instructor/AttendanceReportPage';

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/set-password/:token', element: <SetPasswordPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  {
    path: '/admin',
    element: <MustChangePasswordGuard><AdminLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'users/:id', element: <AdminUserDetailPage /> },
      { path: 'groups', element: <AdminGroupsPage /> },
      { path: 'groups/:id', element: <AdminGroupDetailPage /> },
      { path: 'groups/:groupId/sub-groups/:subGroupId', element: <AdminSubGroupDetailPage /> },
      { path: 'classes', element: <AdminClassesPage /> },
      { path: 'classes/:id', element: <AdminClassDetailPage /> },
      { path: 'assignments', element: <AdminAssignmentsPage /> },
      { path: 'assignments/:id', element: <AdminAssignmentDetailPage /> },
      { path: 'assignments/:id/submissions', element: <AdminSubmissionsReviewPage /> },
      { path: 'documents', element: <AdminDocumentsPage /> },
      { path: 'shared-uploads', element: <AdminSharedUploadsPage /> },
      { path: 'calendar', element: <AdminCalendarPage /> },
      { path: 'attendance', element: <AdminAttendancePage /> },
      { path: 'org-chart', element: <AdminOrgChartPage /> },
      { path: 'attendance/sessions/:id/report', element: <AdminAttendanceReportPage /> },
      { path: 'audit', element: <AdminAuditLogPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
    ],
  },
  {
    path: '/me',
    element: <MustChangePasswordGuard><ParticipantLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <ParticipantDashboardPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'classes/:id', element: <ClassDetailPage /> },
{ path: 'tasks', element: <TasksPage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'submissions', element: <SubmissionsPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
    ],
  },
  {
    path: '/instructor',
    element: <MustChangePasswordGuard><InstructorLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <InstructorDashboardPage /> },
      { path: 'calendar', element: <InstructorCalendarPage /> },
      { path: 'groups', element: <InstructorGroupsPage /> },
      { path: 'groups/:id', element: <InstructorGroupDetailPage /> },
      { path: 'classes', element: <InstructorClassesPage /> },
      { path: 'classes/:id', element: <InstructorClassDetailPage /> },
      { path: 'attendance', element: <InstructorAttendancePage /> },
      { path: 'attendance/sessions/:id/report', element: <InstructorAttendanceReportPage /> },
      { path: 'assignments', element: <InstructorAssignmentsPage /> },
      { path: 'assignments/:id', element: <InstructorAssignmentDetailPage /> },
      { path: 'submissions', element: <InstructorSubmissionsPage /> },
      { path: 'documents', element: <InstructorDocumentsPage /> },
      { path: 'shared-uploads', element: <InstructorSharedUploadsPage /> },
      { path: 'notifications', element: <InstructorNotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  {
    path: '/group-admin',
    element: <MustChangePasswordGuard><GroupAdminLayout /></MustChangePasswordGuard>,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <GroupAdminDashboardPage /> },
      { path: 'participants', element: <GroupAdminParticipantsPage /> },
      { path: 'instructors', element: <GroupAdminInstructorsPage /> },
      { path: 'analytics', element: <GroupAdminAnalyticsPage /> },
      { path: 'sub-groups', element: <GroupAdminSubGroupsPage /> },
      { path: 'sub-groups/:subGroupId', element: <GroupAdminSubGroupDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
    ],
  },
  { path: '/change-password', element: <ForceChangePasswordPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
