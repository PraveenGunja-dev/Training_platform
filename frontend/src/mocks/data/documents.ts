import type { Document, ParticipantSharedDoc } from '@/lib/types';

export const documentsData: Document[] = [
  // g-batch-a documents
  { id: 'doc-001', group_id: 'g-batch-a', class_id: 'c-safety-a-1', title: 'Session 1 — Fire Safety Slides', description: '', file_url: '/files/doc-001.pdf', file_type: 'application/pdf', file_size: 3145728, doc_type: 'SLIDES', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-05T06:00:00Z' },
  { id: 'doc-002', group_id: 'g-batch-a', class_id: 'c-safety-a-1', title: 'Fire Safety Report Template', description: '', file_url: '/files/doc-002.docx', file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_size: 52224, doc_type: 'TEMPLATE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-05T06:10:00Z' },
  { id: 'doc-003', group_id: 'g-batch-a', class_id: 'c-safety-a-2', title: 'Session 2 — Hazard Identification Slides', description: '', file_url: '/files/doc-003.pdf', file_type: 'application/pdf', file_size: 2621440, doc_type: 'SLIDES', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-08T06:00:00Z' },
  { id: 'doc-004', group_id: 'g-batch-a', class_id: 'c-safety-a-2', title: 'Hazard Identification Exercise Template', description: '', file_url: '/files/doc-004.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_size: 48128, doc_type: 'TEMPLATE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-08T06:15:00Z' },
  { id: 'doc-005', group_id: 'g-batch-a', class_id: null, title: 'Pre-Certification Revision Quiz', description: '', file_url: '/files/doc-005.pdf', file_type: 'application/pdf', file_size: 921600, doc_type: 'QUIZ', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-14T08:00:00Z' },
  { id: 'doc-006', group_id: 'g-batch-a', class_id: null, title: 'Safety Manager Report — Internal', description: '', file_url: '/files/doc-006.pdf', file_type: 'application/pdf', file_size: 614400, doc_type: 'REPORT', visibility: 'STAFF_ONLY', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-10T09:00:00Z' },

  // g-batch-b documents
  { id: 'doc-007', group_id: 'g-batch-b', class_id: 'c-safety-b-1', title: 'Safety Induction Orientation Slides', description: '', file_url: '/files/doc-007.pdf', file_type: 'application/pdf', file_size: 4194304, doc_type: 'SLIDES', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-06T08:00:00Z' },
  { id: 'doc-008', group_id: 'g-batch-b', class_id: 'c-safety-b-1', title: 'Workplace Safety Checklist Template', description: '', file_url: '/files/doc-008.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_size: 36864, doc_type: 'TEMPLATE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-06T08:30:00Z' },
  { id: 'doc-009', group_id: 'g-batch-b', class_id: 'c-safety-b-2', title: 'Equipment Safety Walkthrough Guide', description: '', file_url: '/files/doc-009.pdf', file_type: 'application/pdf', file_size: 1572864, doc_type: 'GUIDE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-manager', created_at: '2026-05-13T08:00:00Z' },

  // g-batch-c documents
  { id: 'doc-010', group_id: 'g-batch-c', class_id: 'c-ops-1', title: 'Process Optimisation Methodology', description: '', file_url: '/files/doc-010.pdf', file_type: 'application/pdf', file_size: 2097152, doc_type: 'GUIDE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-mgr-002', created_at: '2026-05-07T03:00:00Z' },
  { id: 'doc-011', group_id: 'g-batch-c', class_id: 'c-ops-2', title: 'KPI Dashboard Reference', description: '', file_url: '/files/doc-011.pdf', file_type: 'application/pdf', file_size: 1048576, doc_type: 'REFERENCE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-mgr-002', created_at: '2026-05-10T03:00:00Z' },
  { id: 'doc-012', group_id: 'g-batch-c', class_id: null, title: 'Capstone Case Study — Confidential Preview', description: '', file_url: '/files/doc-012.pdf', file_type: 'application/pdf', file_size: 786432, doc_type: 'CASE_STUDY', visibility: 'SELECTED', allowed_user_ids: ['u-part-021', 'u-part-022', 'u-part-025'], uploaded_by_id: 'u-mgr-002', created_at: '2026-05-14T10:00:00Z' },

  // g-batch-d documents
  { id: 'doc-013', group_id: 'g-batch-d', class_id: 'c-mgmt-1', title: 'Leadership Frameworks Overview', description: '', file_url: '/files/doc-013.pdf', file_type: 'application/pdf', file_size: 3670016, doc_type: 'SLIDES', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-mgr-003', created_at: '2026-05-08T09:00:00Z' },
  { id: 'doc-014', group_id: 'g-batch-d', class_id: null, title: 'Reflection Journal Writing Guide', description: '', file_url: '/files/doc-014.pdf', file_type: 'application/pdf', file_size: 204800, doc_type: 'GUIDE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-mgr-003', created_at: '2026-05-12T10:00:00Z' },
  { id: 'doc-015', group_id: 'g-batch-d', class_id: null, title: 'Management Cohort Programme Schedule', description: '', file_url: '/files/doc-015.pdf', file_type: 'application/pdf', file_size: 122880, doc_type: 'SCHEDULE', visibility: 'GROUP', allowed_user_ids: [], uploaded_by_id: 'u-admin', created_at: '2026-05-01T10:00:00Z' },
];

export const sharedUploadsData: ParticipantSharedDoc[] = [
  // g-batch-c (u-mgr-002's group)
  {
    id: 'shared-001', group_id: 'g-batch-c', uploaded_by_id: 'u-part-021',
    title: 'Ops Research Gaurav', file_url: '/files/shared-001.pdf',
    file_name: 'ops_research_gaurav.pdf', file_size: 720896, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-14T12:00:00Z',
  },
  {
    id: 'shared-002', group_id: 'g-batch-c', uploaded_by_id: 'u-part-022',
    title: 'Lean Analysis Neelam', file_url: '/files/shared-002.pdf',
    file_name: 'lean_analysis_neelam.pdf', file_size: 548864, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'APPROVED', reviewed_by_id: 'u-mgr-002', reviewed_at: '2026-05-13T09:00:00Z', rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-12T15:30:00Z',
  },
  // g-batch-a (u-manager's group)
  {
    id: 'shared-003', group_id: 'g-batch-a', uploaded_by_id: 'u-part-003',
    title: 'Safety Tips', file_url: '/files/shared-003.pdf',
    file_name: 'safety_tips_divya.pdf', file_size: 204800, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'REJECTED', reviewed_by_id: 'u-manager', reviewed_at: '2026-05-11T10:00:00Z',
    rejection_reason: 'Document contains unverified safety information. Please revise.', resulting_document_id: null,
    created_at: '2026-05-10T14:00:00Z',
  },
  {
    id: 'shared-004', group_id: 'g-batch-a', uploaded_by_id: 'u-part-004',
    title: 'PPE Guidelines', file_url: '/files/shared-004.pdf',
    file_name: 'ppe_guidelines_kiran.pdf', file_size: 315392, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-15T08:30:00Z',
  },
  {
    id: 'shared-005', group_id: 'g-batch-a', uploaded_by_id: 'u-part-007',
    title: 'Fire Exit Photo', file_url: '/files/shared-005.jpg',
    file_name: 'fire_exit_photo_rohit.jpg', file_size: 1048576, file_type: 'image/jpeg',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-15T10:00:00Z',
  },
  {
    id: 'shared-006', group_id: 'g-batch-b', uploaded_by_id: 'u-part-013',
    title: 'Safety Checklist', file_url: '/files/shared-006.pdf',
    file_name: 'safety_checklist_rahul.pdf', file_size: 256000, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-14T16:45:00Z',
  },
  {
    id: 'shared-007', group_id: 'g-batch-b', uploaded_by_id: 'u-part-016',
    title: 'Incident Report', file_url: '/files/shared-007.pdf',
    file_name: 'incident_report_ritu.pdf', file_size: 184320, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-15T06:15:00Z',
  },
  {
    id: 'shared-008', group_id: 'g-batch-c', uploaded_by_id: 'u-part-025',
    title: 'Process Map', file_url: '/files/shared-008.pdf',
    file_name: 'process_map_mohan.pdf', file_size: 614400, file_type: 'application/pdf',
    suggested_visibility: 'GROUP', suggested_user_ids: [],
    status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
    created_at: '2026-05-15T11:00:00Z',
  },
];
