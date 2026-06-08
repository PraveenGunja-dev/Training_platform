import { http, HttpResponse } from 'msw';
import { classesData } from '../data/classes';
import { assignmentsData } from '../data/assignments';
import { submissionsData } from '../data/submissions';
import { documentsData } from '../data/documents';
import { groupsData, groupMemberships } from '../data/groups';
import { usersData } from '../data/users';
import { attendanceRecordsData } from '../data/attendance';

function pseudoStat(seed: string, min = 60, max = 100): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h >>> 0;
  }
  return min + (h % (max - min + 1));
}

function buildParticipantActivity() {
  return usersData
    .filter(u => u.role === 'PARTICIPANT')
    .map(u => {
      const groupId = Object.entries(groupMemberships).find(([, m]) =>
        m.participant_ids.includes(u.id),
      )?.[0];
      const group = groupsData.find(g => g.id === groupId);

      const groupClasses = classesData.filter(c => c.group_id === groupId);
      const presentCount = attendanceRecordsData.filter(
        r =>
          r.user_id === u.id &&
          groupClasses.some(c => c.id === r.class_id) &&
          ['PRESENT', 'LATE', 'MANUAL_PRESENT'].includes(r.status),
      ).length;
      const attendance_rate =
        groupClasses.length > 0
          ? Math.round((presentCount / groupClasses.length) * 100)
          : pseudoStat(u.id + 'att');

      const groupTasks = assignmentsData.filter(t => t.group_id === groupId);
      const submittedCount = submissionsData.filter(
        s => s.user_id === u.id && groupTasks.some(t => t.id === s.task_id),
      ).length;
      const submission_rate =
        groupTasks.length > 0
          ? Math.round((submittedCount / groupTasks.length) * 100)
          : pseudoStat(u.id + 'sub');

      const lastSub = submissionsData
        .filter(s => s.user_id === u.id)
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];

      return {
        id: u.id,
        name: u.full_name,
        group_name: group?.name ?? 'Unknown',
        attendance_rate,
        submission_rate,
        last_activity: lastSub?.submitted_at ?? null,
      };
    });
}

export const dashboardHandlers = [
  http.get('*/api/v1/dashboard/admin', () => {
    const classesToday = classesData.filter(c => c.status === 'ONGOING').length;
    const classesUpcoming = classesData.filter(c => c.status === 'UPCOMING').length;
    const classesCompleted = classesData.filter(c => c.status === 'COMPLETED').length;
    const submitted = submissionsData.filter(s => s.status === 'SUBMITTED').length;
    const late = submissionsData.filter(s => s.status === 'LATE_SUBMITTED').length;

    return HttpResponse.json({
      data: {
        kpis: {
          total_groups: groupsData.length,
          total_participants: usersData.filter(u => u.role === 'PARTICIPANT').length,
          classes_today: classesToday,
          classes_upcoming: classesUpcoming,
          classes_completed: classesCompleted,
          submitted,
          pending: 12,
          late,
          video_uploads: 0,
          doc_uploads: documentsData.length,
          pending_approvals: 1,
        },
        charts: {
          attendance_pie: [
            { label: 'Present', value: 72 },
            { label: 'Absent', value: 12 },
            { label: 'Late', value: 6 },
            { label: 'Manual Present', value: 4 },
          ],
          submission_bar: [
            { group_name: 'Batch A', submitted: 16, pending: 4, late: 1 },
            { group_name: 'Batch B', submitted: 9, pending: 1, late: 0 },
            { group_name: 'Ops Group', submitted: 6, pending: 2, late: 2 },
            { group_name: 'Mgmt Cohort', submitted: 3, pending: 2, late: 0 },
          ],
          group_comparison: [
            { group_name: 'Batch A', attendance_rate: 82, submission_rate: 73 },
            { group_name: 'Batch B', attendance_rate: 80, submission_rate: 90 },
            { group_name: 'Ops Group', attendance_rate: 85, submission_rate: 80 },
            { group_name: 'Mgmt Cohort', attendance_rate: 80, submission_rate: 60 },
          ],
          daily_upload_trend: [
            { date: '2026-05-02', count: 2 },
            { date: '2026-05-03', count: 0 },
            { date: '2026-05-04', count: 5 },
            { date: '2026-05-05', count: 3 },
            { date: '2026-05-06', count: 0 },
            { date: '2026-05-07', count: 0 },
            { date: '2026-05-08', count: 4 },
            { date: '2026-05-09', count: 8 },
            { date: '2026-05-10', count: 0 },
            { date: '2026-05-11', count: 0 },
            { date: '2026-05-12', count: 2 },
            { date: '2026-05-13', count: 3 },
            { date: '2026-05-14', count: 9 },
            { date: '2026-05-15', count: 5 },
          ],
          deadline_tracking: [
            { task_title: 'Safety Compliance Report', deadline_at: '2026-05-20T23:59:00Z', pending_count: 14 },
            { task_title: 'Pre-Certification Revision Quiz', deadline_at: '2026-05-21T23:59:00Z', pending_count: 10 },
            { task_title: 'Emergency Procedure Drill Writeup', deadline_at: '2026-05-22T23:59:00Z', pending_count: 7 },
            { task_title: 'Operations Case Study', deadline_at: '2026-05-24T23:59:00Z', pending_count: 5 },
            { task_title: 'Leadership Reflection Journal', deadline_at: '2026-05-26T23:59:00Z', pending_count: 2 },
            { task_title: 'Final Assessment Submission', deadline_at: '2026-05-30T23:59:00Z', pending_count: 18 },
          ],
          weekly_trend: [
            { week: 'Week 1', attendance_rate: 74, submission_rate: 62 },
            { week: 'Week 2', attendance_rate: 79, submission_rate: 68 },
            { week: 'Week 3', attendance_rate: 82, submission_rate: 74 },
            { week: 'Week 4', attendance_rate: 85, submission_rate: 80 },
          ],
          class_status: [
            { label: 'Completed', value: classesCompleted },
            { label: 'Upcoming',  value: classesUpcoming  },
            { label: 'Ongoing',   value: classesToday      },
            { label: 'Cancelled', value: 0                 },
          ],
        },
        recent_documents: documentsData.slice(0, 5),
        recent_activity: [
          { id: 'audit-001', actor_name: 'Gaurav Singh', action: 'shared_doc.upload', target_type: 'ClassGroup', target_id: 'g-batch-c', created_at: '2026-05-14T12:00:00Z' },
          { id: 'audit-002', actor_name: 'Manish Kumar', action: 'attendance.override', target_type: 'AttendanceRecord', target_id: 'att-a2-p09', created_at: '2026-05-12T10:00:00Z' },
          { id: 'audit-003', actor_name: 'Kiran K R', action: 'user.invite', target_type: 'User', target_id: 'u-part-030', created_at: '2026-02-18T00:00:00Z' },
        ],
        participant_activity: buildParticipantActivity(),
      },
    });
  }),

  http.get('*/api/v1/dashboard/participant', () => {
    const todayClass = classesData.find(c => c.id === 'c-safety-a-4') ?? null;
    const openTasks = assignmentsData
      .filter(t => (t.group_id === 'g-batch-a' || t.group_id === 'g-batch-d') && t.is_open)
      .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at))
      .slice(0, 3);
    const recentDocs = documentsData
      .filter(d => d.group_id === 'g-batch-a' && d.visibility === 'GROUP')
      .slice(0, 3);
    const recentSubmissions = submissionsData
      .filter(s => s.user_id === 'u-part')
      .slice(-3)
      .reverse();

    return HttpResponse.json({
      data: {
        today: {
          class: todayClass,
          attendance_status: null,
          mark_attendance_open: true,
          attendance_open_at: todayClass?.attendance_open_at ?? null,
          attendance_close_at: todayClass?.attendance_close_at ?? null,
        },
        pending_tasks: openTasks,
        recent_documents: recentDocs,
        recent_submissions: recentSubmissions,
        quick_stats: {
          attendance_rate: 82,
          submitted_count: submissionsData.filter(s => s.user_id === 'u-part').length,
          pending_count: openTasks.length,
        },
      },
    });
  }),
];
