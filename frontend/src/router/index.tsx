import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootRedirect } from './RootRedirect';
import { AuthOnly } from './RoleGuard';
import { MustChangePasswordGuard } from './MustChangePasswordGuard';
import { AdminLayout, ParticipantLayout, SubMentorLayout, LeadMentorLayout } from '@/components/layout/AppShell';

// Named-export auth pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const SetPasswordPage = lazy(() => import('@/pages/auth/SetPasswordPage').then(m => ({ default: m.SetPasswordPage })));
const ProfilePage = lazy(() => import('@/pages/auth/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ForbiddenPage = lazy(() => import('@/pages/auth/ForbiddenPage').then(m => ({ default: m.ForbiddenPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const ForceChangePasswordPage = lazy(() => import('@/pages/auth/ForceChangePasswordPage').then(m => ({ default: m.ForceChangePasswordPage })));

// Lead-mentor pages
const LeadMentorDashboardPage = lazy(() => import('@/pages/lead-mentor/DashboardPage'));
const LeadMentorSubGroupDetailPage = lazy(() => import('@/pages/lead-mentor/SubGroupDetailPage'));
const LeadMentorParticipantsPage = lazy(() => import('@/pages/lead-mentor/ParticipantsPage'));
const LeadMentorAnalyticsPage = lazy(() => import('@/pages/lead-mentor/AnalyticsPage'));
const LeadMentorSubMentorsPage = lazy(() => import('@/pages/lead-mentor/SubMentorsPage'));
const LeadMentorSubGroupsPage = lazy(() => import('@/pages/lead-mentor/SubGroupsPage'));
const LeadMentorCalendarPage = lazy(() => import('@/pages/lead-mentor/CalendarPage'));
const LeadMentorSubMentorProfilePage = lazy(() => import('@/pages/lead-mentor/SubMentorProfilePage'));

// Admin pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const AdminUserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage'));
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const AdminGroupsPage = lazy(() => import('@/pages/admin/GroupsPage'));
const AdminGroupDetailPage = lazy(() => import('@/pages/admin/GroupDetailPage'));
const AdminClassesPage = lazy(() => import('@/pages/admin/ClassesPage'));
const AdminClassDetailPage = lazy(() => import('@/pages/admin/ClassDetailPage'));
const AdminAssignmentsPage = lazy(() => import('@/pages/admin/AssignmentsPage'));
const AdminAssignmentDetailPage = lazy(() => import('@/pages/admin/AssignmentDetailPage'));
const AdminSubmissionsReviewPage = lazy(() => import('@/pages/admin/SubmissionsReviewPage'));
const AdminDocumentsPage = lazy(() => import('@/pages/admin/DocumentsPage'));
const AdminSharedUploadsPage = lazy(() => import('@/pages/admin/SharedUploadsPage'));
const AdminAttendancePage = lazy(() => import('@/pages/admin/AttendancePage'));
const AdminAttendanceReportPage = lazy(() => import('@/pages/admin/AttendanceReportPage'));
const AdminCalendarPage = lazy(() => import('@/pages/admin/CalendarPage'));
const AdminOrgChartPage = lazy(() => import('@/pages/admin/OrgChartPage'));
const AdminSubGroupDetailPage = lazy(() => import('@/pages/admin/SubGroupDetailPage'));

// Participant (me) pages
const ParticipantDashboardPage = lazy(() => import('@/pages/me/DashboardPage'));
const NotificationsPage = lazy(() => import('@/pages/me/NotificationsPage'));
const CalendarPage = lazy(() => import('@/pages/me/CalendarPage'));
const ClassDetailPage = lazy(() => import('@/pages/me/ClassDetailPage'));
const TasksPage = lazy(() => import('@/pages/me/TasksPage'));
const TaskDetailPage = lazy(() => import('@/pages/me/TaskDetailPage'));
const SubmissionsPage = lazy(() => import('@/pages/me/SubmissionsPage'));
const DocumentsPage = lazy(() => import('@/pages/me/DocumentsPage'));

// Sub-mentor pages
const SubMentorDashboardPage = lazy(() => import('@/pages/sub-mentor/DashboardPage'));
const SubMentorCalendarPage = lazy(() => import('@/pages/sub-mentor/CalendarPage'));
const SubMentorGroupsPage = lazy(() => import('@/pages/sub-mentor/GroupsPage'));
const SubMentorGroupDetailPage = lazy(() => import('@/pages/sub-mentor/GroupDetailPage'));
const SubMentorClassesPage = lazy(() => import('@/pages/sub-mentor/ClassesPage'));
const SubMentorClassDetailPage = lazy(() => import('@/pages/sub-mentor/ClassDetailPage'));
const SubMentorAttendancePage = lazy(() => import('@/pages/sub-mentor/AttendancePage'));
const SubMentorAssignmentsPage = lazy(() => import('@/pages/sub-mentor/AssignmentsPage'));
const SubMentorAssignmentDetailPage = lazy(() => import('@/pages/sub-mentor/AssignmentDetailPage'));
const SubMentorSubmissionsPage = lazy(() => import('@/pages/sub-mentor/SubmissionsPage'));
const SubMentorDocumentsPage = lazy(() => import('@/pages/sub-mentor/DocumentsPage'));
const SubMentorSharedUploadsPage = lazy(() => import('@/pages/sub-mentor/SharedUploadsPage'));
const SubMentorNotificationsPage = lazy(() => import('@/pages/sub-mentor/NotificationsPage'));
const SubMentorAttendanceReportPage = lazy(() => import('@/pages/sub-mentor/AttendanceReportPage'));
const ParticipantProfilePage = lazy(() => import('@/pages/sub-mentor/ParticipantProfilePage'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
    </div>
  );
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <S><LoginPage /></S> },
  { path: '/set-password/:token', element: <S><SetPasswordPage /></S> },
  { path: '/403', element: <S><ForbiddenPage /></S> },
  {
    path: '/admin',
    element: <MustChangePasswordGuard><AdminLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <S><AdminDashboardPage /></S> },
      { path: 'users', element: <S><AdminUsersPage /></S> },
      { path: 'users/:id', element: <S><AdminUserDetailPage /></S> },
      { path: 'groups', element: <S><AdminGroupsPage /></S> },
      { path: 'groups/:id', element: <S><AdminGroupDetailPage /></S> },
      { path: 'groups/:groupId/sub-groups/:subGroupId', element: <S><AdminSubGroupDetailPage /></S> },
      { path: 'classes', element: <S><AdminClassesPage /></S> },
      { path: 'classes/:id', element: <S><AdminClassDetailPage /></S> },
      { path: 'assignments', element: <S><AdminAssignmentsPage /></S> },
      { path: 'assignments/:id', element: <S><AdminAssignmentDetailPage /></S> },
      { path: 'assignments/:id/submissions', element: <S><AdminSubmissionsReviewPage /></S> },
      { path: 'documents', element: <S><AdminDocumentsPage /></S> },
      { path: 'shared-uploads', element: <S><AdminSharedUploadsPage /></S> },
      { path: 'calendar', element: <S><AdminCalendarPage /></S> },
      { path: 'attendance', element: <S><AdminAttendancePage /></S> },
      { path: 'org-chart', element: <S><AdminOrgChartPage /></S> },
      { path: 'attendance/sessions/:id/report', element: <S><AdminAttendanceReportPage /></S> },
      { path: 'audit', element: <S><AdminAuditLogPage /></S> },
      { path: 'settings', element: <S><AdminSettingsPage /></S> },
      { path: 'profile', element: <S><ProfilePage /></S> },
      { path: 'notifications', element: <S><NotificationsPage /></S> },
    ],
  },
  {
    path: '/me',
    element: <MustChangePasswordGuard><ParticipantLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <S><ParticipantDashboardPage /></S> },
      { path: 'calendar', element: <S><CalendarPage /></S> },
      { path: 'classes/:id', element: <S><ClassDetailPage /></S> },
      { path: 'tasks', element: <S><TasksPage /></S> },
      { path: 'tasks/:id', element: <S><TaskDetailPage /></S> },
      { path: 'submissions', element: <S><SubmissionsPage /></S> },
      { path: 'documents', element: <S><DocumentsPage /></S> },
      { path: 'profile', element: <S><ProfilePage /></S> },
      { path: 'notifications', element: <S><NotificationsPage /></S> },
    ],
  },
  {
    path: '/sub-mentor',
    element: <MustChangePasswordGuard><SubMentorLayout /></MustChangePasswordGuard>,
    children: [
      { path: 'dashboard', element: <S><SubMentorDashboardPage /></S> },
      { path: 'calendar', element: <S><SubMentorCalendarPage /></S> },
      { path: 'groups', element: <S><SubMentorGroupsPage /></S> },
      { path: 'groups/:id', element: <S><SubMentorGroupDetailPage /></S> },
      { path: 'classes', element: <S><SubMentorClassesPage /></S> },
      { path: 'classes/:id', element: <S><SubMentorClassDetailPage /></S> },
      { path: 'attendance', element: <S><SubMentorAttendancePage /></S> },
      { path: 'attendance/sessions/:id/report', element: <S><SubMentorAttendanceReportPage /></S> },
      { path: 'assignments', element: <S><SubMentorAssignmentsPage /></S> },
      { path: 'assignments/:id', element: <S><SubMentorAssignmentDetailPage /></S> },
      { path: 'submissions', element: <S><SubMentorSubmissionsPage /></S> },
      { path: 'documents', element: <S><SubMentorDocumentsPage /></S> },
      { path: 'shared-uploads', element: <S><SubMentorSharedUploadsPage /></S> },
      { path: 'notifications', element: <S><SubMentorNotificationsPage /></S> },
      { path: 'profile', element: <S><ProfilePage /></S> },
      { path: 'participants/:id', element: <S><ParticipantProfilePage /></S> },
    ],
  },
  {
    path: '/lead-mentor',
    element: <MustChangePasswordGuard><LeadMentorLayout /></MustChangePasswordGuard>,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <S><LeadMentorDashboardPage /></S> },
      { path: 'calendar', element: <S><LeadMentorCalendarPage /></S> },
      { path: 'classes', element: <S><SubMentorClassesPage /></S> },
      { path: 'classes/:id', element: <S><SubMentorClassDetailPage /></S> },
      { path: 'attendance', element: <S><SubMentorAttendancePage /></S> },
      { path: 'attendance/sessions/:id/report', element: <S><SubMentorAttendanceReportPage /></S> },
      { path: 'participants', element: <S><LeadMentorParticipantsPage /></S> },
      { path: 'sub-mentors', element: <S><LeadMentorSubMentorsPage /></S> },
      { path: 'analytics', element: <S><LeadMentorAnalyticsPage /></S> },
      { path: 'sub-groups', element: <S><LeadMentorSubGroupsPage /></S> },
      { path: 'sub-groups/:subGroupId', element: <S><LeadMentorSubGroupDetailPage /></S> },
      { path: 'groups/:groupId/sub-groups/:subGroupId', element: <S><LeadMentorSubGroupDetailPage /></S> },
      { path: 'assignments', element: <S><SubMentorAssignmentsPage /></S> },
      { path: 'assignments/:id', element: <S><SubMentorAssignmentDetailPage /></S> },
      { path: 'submissions', element: <S><SubMentorSubmissionsPage /></S> },
      { path: 'documents', element: <S><SubMentorDocumentsPage /></S> },
      { path: 'shared-uploads', element: <S><SubMentorSharedUploadsPage /></S> },
      { path: 'profile', element: <S><ProfilePage /></S> },
      { path: 'notifications', element: <S><NotificationsPage /></S> },
      { path: 'participants/:id', element: <S><ParticipantProfilePage /></S> },
      { path: 'sub-mentors/:id', element: <S><LeadMentorSubMentorProfilePage /></S> },
    ],
  },
  { path: '/change-password', element: <AuthOnly><S><ForceChangePasswordPage /></S></AuthOnly> },
  { path: '*', element: <S><NotFoundPage /></S> },
], {
  basename: import.meta.env.BASE_URL,
});
