import type { ClassSession } from '@/lib/types';

export const classesData: ClassSession[] = [
  // --- g-batch-a (COMPLETED) ---
  {
    id: 'c-safety-a-1', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Fundamentals — Session 1', description: 'Fire safety, evacuation procedures, PPE basics.',
    starts_at: '2026-05-05T04:30:00Z', ends_at: '2026-05-05T06:30:00Z',
    attendance_open_at: '2026-05-05T04:00:00Z', attendance_close_at: '2026-05-05T05:00:00Z',
    allow_late_attendance: false, status: 'COMPLETED',
  },
  {
    id: 'c-safety-a-2', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Fundamentals — Session 2', description: 'Hazard identification and risk assessment.',
    starts_at: '2026-05-17T00:00:00Z', ends_at: '2999-12-31T23:59:00Z',
    attendance_open_at: '2026-05-17T00:00:00Z', attendance_close_at: '2999-12-31T23:59:00Z',
    allow_late_attendance: true, status: 'ONGOING',
  },
  {
    id: 'c-safety-a-3', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Fundamentals — Session 3', description: 'Emergency response and first aid.',
    starts_at: '2026-05-12T04:30:00Z', ends_at: '2026-05-12T06:30:00Z',
    attendance_open_at: '2026-05-12T04:00:00Z', attendance_close_at: '2026-05-12T05:00:00Z',
    allow_late_attendance: false, status: 'COMPLETED',
  },
  // --- g-batch-a (UPCOMING) ---
  {
    id: 'c-safety-a-4', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Assessment & Certification', description: 'Final session: written test + certification.',
    starts_at: '2026-05-17T04:30:00Z', ends_at: '2026-05-17T07:30:00Z',
    attendance_open_at: '2026-05-17T04:00:00Z', attendance_close_at: '2026-05-17T05:00:00Z',
    allow_late_attendance: false, status: 'UPCOMING',
  },
  // --- g-batch-b (COMPLETED) ---
  {
    id: 'c-safety-b-1', group_id: 'g-batch-b', group_name: 'Safety Induction Batch B',
    title: 'Safety Induction — Intro', description: 'Orientation to workplace safety standards.',
    starts_at: '2026-05-06T08:30:00Z', ends_at: '2026-05-06T10:30:00Z',
    attendance_open_at: '2026-05-06T08:00:00Z', attendance_close_at: '2026-05-06T09:00:00Z',
    allow_late_attendance: false, status: 'COMPLETED',
  },
  {
    id: 'c-safety-b-2', group_id: 'g-batch-b', group_name: 'Safety Induction Batch B',
    title: 'Safety Induction — Practical', description: 'Hands-on safety equipment walkthrough.',
    starts_at: '2026-05-13T08:30:00Z', ends_at: '2026-05-13T10:30:00Z',
    attendance_open_at: '2026-05-13T08:00:00Z', attendance_close_at: '2026-05-13T09:00:00Z',
    allow_late_attendance: true, status: 'COMPLETED',
  },
  // --- g-batch-b (UPCOMING) ---
  {
    id: 'c-safety-b-3', group_id: 'g-batch-b', group_name: 'Safety Induction Batch B',
    title: 'Safety Induction — Final Review', description: 'Q&A, debrief, and certification handover.',
    starts_at: '2026-05-18T08:30:00Z', ends_at: '2026-05-18T10:30:00Z',
    attendance_open_at: '2026-05-18T08:00:00Z', attendance_close_at: '2026-05-18T09:00:00Z',
    allow_late_attendance: false, status: 'UPCOMING',
  },
  // --- g-batch-c (COMPLETED) ---
  {
    id: 'c-ops-1', group_id: 'g-batch-c', group_name: 'Advanced Operations Group',
    title: 'Advanced Operations — Module 1', description: 'Process optimization and workflow analysis.',
    starts_at: '2026-05-07T03:30:00Z', ends_at: '2026-05-07T05:30:00Z',
    attendance_open_at: '2026-05-07T03:00:00Z', attendance_close_at: '2026-05-07T04:00:00Z',
    allow_late_attendance: false, status: 'COMPLETED',
  },
  {
    id: 'c-ops-2', group_id: 'g-batch-c', group_name: 'Advanced Operations Group',
    title: 'Advanced Operations — Module 2', description: 'KPI tracking and performance dashboards.',
    starts_at: '2026-05-10T03:30:00Z', ends_at: '2026-05-10T05:30:00Z',
    attendance_open_at: '2026-05-10T03:00:00Z', attendance_close_at: '2026-05-10T04:00:00Z',
    allow_late_attendance: true, status: 'COMPLETED',
  },
  // --- g-batch-c (ONGOING today 2026-05-15) ---
  {
    id: 'c-ops-3', group_id: 'g-batch-c', group_name: 'Advanced Operations Group',
    title: 'Advanced Operations — Module 3', description: 'Resource allocation and capacity planning.',
    starts_at: '2026-05-15T03:30:00Z', ends_at: '2026-05-15T05:30:00Z',
    attendance_open_at: '2026-05-15T03:00:00Z', attendance_close_at: '2026-05-15T04:30:00Z',
    allow_late_attendance: false, status: 'ONGOING',
  },
  // --- g-batch-c (UPCOMING) ---
  {
    id: 'c-ops-4', group_id: 'g-batch-c', group_name: 'Advanced Operations Group',
    title: 'Advanced Operations — Capstone', description: 'Live case study and group presentation.',
    starts_at: '2026-05-20T03:30:00Z', ends_at: '2026-05-20T06:30:00Z',
    attendance_open_at: '2026-05-20T03:00:00Z', attendance_close_at: '2026-05-20T04:30:00Z',
    allow_late_attendance: false, status: 'UPCOMING',
  },
  // --- g-batch-d (COMPLETED) ---
  {
    id: 'c-mgmt-1', group_id: 'g-batch-d', group_name: 'Management Training Cohort',
    title: 'Leadership Fundamentals', description: 'Situational leadership and team dynamics.',
    starts_at: '2026-05-08T09:30:00Z', ends_at: '2026-05-08T12:30:00Z',
    attendance_open_at: '2026-05-08T09:00:00Z', attendance_close_at: '2026-05-08T10:00:00Z',
    allow_late_attendance: false, status: 'COMPLETED',
  },
  // --- g-batch-d (UPCOMING) ---
  {
    id: 'c-mgmt-2', group_id: 'g-batch-d', group_name: 'Management Training Cohort',
    title: 'Communication & Stakeholder Management', description: 'Effective communication frameworks.',
    starts_at: '2026-05-20T09:30:00Z', ends_at: '2026-05-20T12:30:00Z',
    attendance_open_at: '2026-05-20T09:00:00Z', attendance_close_at: '2026-05-20T10:00:00Z',
    allow_late_attendance: false, status: 'UPCOMING',
  },

  // --- Calendar demo classes for u-part (g-batch-a) ---

  // Yesterday (2026-05-14) — COMPLETED, u-part PRESENT
  {
    id: 'c-safety-a-yesterday', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Supplementary Session', description: 'Additional practice and debrief.',
    starts_at: '2026-05-14T04:30:00Z', ends_at: '2026-05-14T06:30:00Z',
    attendance_open_at: '2026-05-14T04:00:00Z', attendance_close_at: '2026-05-14T05:30:00Z',
    allow_late_attendance: true, status: 'COMPLETED',
  },

  // Today (2026-05-15) — ONGOING, wide attendance window covering the whole day, u-part NOT marked
  {
    id: 'c-safety-a-today', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Live Demo & Q&A', description: 'Live demonstration of safety protocols.',
    starts_at: '2026-05-15T04:30:00Z', ends_at: '2026-05-15T06:30:00Z',
    attendance_open_at: '2026-05-15T00:00:00Z', attendance_close_at: '2026-05-15T23:59:00Z',
    allow_late_attendance: true, status: 'ONGOING',
  },

  // Tomorrow (2026-05-16) — UPCOMING, window not open yet
  {
    id: 'c-safety-a-tomorrow', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Drills & Practice', description: 'Hands-on safety drills and equipment practice.',
    starts_at: '2026-05-16T04:30:00Z', ends_at: '2026-05-16T06:30:00Z',
    attendance_open_at: '2026-05-16T04:00:00Z', attendance_close_at: '2026-05-16T05:30:00Z',
    allow_late_attendance: false, status: 'UPCOMING',
  },

  // Next week (2026-05-22) — UPCOMING
  {
    id: 'c-safety-a-nextweek', group_id: 'g-batch-a', group_name: 'Safety Induction Batch A',
    title: 'Safety Module Review', description: 'Comprehensive review before final certification.',
    starts_at: '2026-05-22T04:30:00Z', ends_at: '2026-05-22T06:30:00Z',
    attendance_open_at: '2026-05-22T04:00:00Z', attendance_close_at: '2026-05-22T05:30:00Z',
    allow_late_attendance: false, status: 'UPCOMING',
  },
];
