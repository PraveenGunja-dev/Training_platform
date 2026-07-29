import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootRedirect } from './RootRedirect';
import { MustChangePasswordGuard } from './MustChangePasswordGuard';
import { AdminLayout, ParticipantLayout, SubMentorLayout, LeadMentorLayout } from '@/components/layout/AppShell';
import { ForceChangePasswordPage } from '@/pages/auth/ForceChangePasswordPage';
import LeadMentorDashboardPage from '@/pages/lead-mentor/DashboardPage';
import LeadMentorSubGroupDetailPage from '@/pages/lead-mentor/SubGroupDetailPage';
import LeadMentorParticipantsPage from '@/pages/lead-mentor/ParticipantsPage';
import LeadMentorAnalyticsPage from '@/pages/lead-mentor/AnalyticsPage';
import LeadMentorSubMentorsPage from '@/pages/lead-mentor/SubMentorsPage';
import LeadMentorSubGroupsPage from '@/pages/lead-mentor/SubGroupsPage';
import LeadMentorCalendarPage from '@/pages/lead-mentor/CalendarPage';
import LeadMentorSubMentorProfilePage from '@/pages/lead-mentor/SubMentorProfilePage';
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
import SubMentorDashboardPage from '@/pages/sub-mentor/DashboardPage';
import SubMentorCalendarPage from '@/pages/sub-mentor/CalendarPage';
import SubMentorGroupsPage from '@/pages/sub-mentor/GroupsPage';
import SubMentorGroupDetailPage from '@/pages/sub-mentor/GroupDetailPage';
import SubMentorClassesPage from '@/pages/sub-mentor/ClassesPage';
import SubMentorClassDetailPage from '@/pages/sub-mentor/ClassDetailPage';
import SubMentorAttendancePage from '@/pages/sub-mentor/AttendancePage';
import SubMentorAssignmentsPage from '@/pages/sub-mentor/AssignmentsPage';
import SubMentorAssignmentDetailPage from '@/pages/sub-mentor/AssignmentDetailPage';
import SubMentorSubmissionsPage from '@/pages/sub-mentor/SubmissionsPage';
import SubMentorDocumentsPage from '@/pages/sub-mentor/DocumentsPage';
import SubMentorSharedUploadsPage from '@/pages/sub-mentor/SharedUploadsPage';
import SubMentorNotificationsPage from '@/pages/sub-mentor/NotificationsPage';
import SubMentorAttendanceReportPage from '@/pages/sub-mentor/AttendanceReportPage';
import ParticipantProfilePage from '@/pages/sub-mentor/ParticipantProfilePage';

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
    path: '/sub-mentor',
    element: <MustChangePasswordGuard><SubMentorLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <SubMentorDashboardPage /> },
      { path: 'calendar', element: <SubMentorCalendarPage /> },
      { path: 'groups', element: <SubMentorGroupsPage /> },
      { path: 'groups/:id', element: <SubMentorGroupDetailPage /> },
      { path: 'classes', element: <SubMentorClassesPage /> },
      { path: 'classes/:id', element: <SubMentorClassDetailPage /> },
      { path: 'attendance', element: <SubMentorAttendancePage /> },
      { path: 'attendance/sessions/:id/report', element: <SubMentorAttendanceReportPage /> },
      { path: 'assignments', element: <SubMentorAssignmentsPage /> },
      { path: 'assignments/:id', element: <SubMentorAssignmentDetailPage /> },
      { path: 'submissions', element: <SubMentorSubmissionsPage /> },
      { path: 'documents', element: <SubMentorDocumentsPage /> },
      { path: 'shared-uploads', element: <SubMentorSharedUploadsPage /> },
      { path: 'notifications', element: <SubMentorNotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'participants/:id', element: <ParticipantProfilePage /> },
    ],
  },
  {
    path: '/lead-mentor',
    element: <MustChangePasswordGuard><LeadMentorLayout /></MustChangePasswordGuard>,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <LeadMentorDashboardPage /> },
      { path: 'calendar', element: <LeadMentorCalendarPage /> },
      { path: 'classes', element: <SubMentorClassesPage /> },
      { path: 'classes/:id', element: <SubMentorClassDetailPage /> },
      { path: 'attendance', element: <SubMentorAttendancePage /> },
      { path: 'attendance/sessions/:id/report', element: <SubMentorAttendanceReportPage /> },
      { path: 'participants', element: <LeadMentorParticipantsPage /> },
      { path: 'sub-mentors', element: <LeadMentorSubMentorsPage /> },
      { path: 'analytics', element: <LeadMentorAnalyticsPage /> },
      { path: 'sub-groups', element: <LeadMentorSubGroupsPage /> },
      { path: 'sub-groups/:subGroupId', element: <LeadMentorSubGroupDetailPage /> },
      { path: 'assignments', element: <SubMentorAssignmentsPage /> },
      { path: 'assignments/:id', element: <SubMentorAssignmentDetailPage /> },
      { path: 'submissions', element: <SubMentorSubmissionsPage /> },
      { path: 'documents', element: <SubMentorDocumentsPage /> },
      { path: 'shared-uploads', element: <SubMentorSharedUploadsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'participants/:id', element: <ParticipantProfilePage /> },
      { path: 'sub-mentors/:id', element: <LeadMentorSubMentorProfilePage /> },
    ],
  },
  { path: '/change-password', element: <ForceChangePasswordPage /> },
  { path: '*', element: <NotFoundPage /> },
], {
  basename: import.meta.env.BASE_URL,
});
