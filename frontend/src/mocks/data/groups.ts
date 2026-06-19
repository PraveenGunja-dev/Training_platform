import type { ClassGroup } from '@/lib/types';

export interface GroupMembership {
  participant_ids: string[];
}

export const groupsData: ClassGroup[] = [
  {
    id: 'g-batch-a', name: 'Safety Induction Batch A',
    description: 'First batch for safety induction training — May 2026.',
    participants_count: 10, is_archived: false, created_at: '2026-01-20T00:00:00Z', instructors: [],
  },
  {
    id: 'g-batch-b', name: 'Safety Induction Batch B',
    description: 'Second batch for safety induction training — May 2026.',
    participants_count: 10, is_archived: false, created_at: '2026-01-22T00:00:00Z', instructors: [],
  },
  {
    id: 'g-batch-c', name: 'Advanced Operations Group',
    description: 'Advanced operations training for senior staff.',
    participants_count: 10, is_archived: false, created_at: '2026-02-01T00:00:00Z', instructors: [],
  },
  {
    id: 'g-batch-d', name: 'Management Training Cohort',
    description: 'Cross-functional management training cohort.',
    participants_count: 5, is_archived: false, created_at: '2026-02-10T00:00:00Z', instructors: [],
  },
];

export const groupMemberships: Record<string, GroupMembership> = {
  'g-batch-a': {
    participant_ids: ['u-part', 'u-part-002', 'u-part-003', 'u-part-004', 'u-part-005',
      'u-part-006', 'u-part-007', 'u-part-008', 'u-part-009', 'u-part-010'],
  },
  'g-batch-b': {
    participant_ids: ['u-part-011', 'u-part-012', 'u-part-013', 'u-part-014', 'u-part-015',
      'u-part-016', 'u-part-017', 'u-part-018', 'u-part-019', 'u-part-020'],
  },
  'g-batch-c': {
    participant_ids: ['u-part-021', 'u-part-022', 'u-part-023', 'u-part-024', 'u-part-025',
      'u-part-026', 'u-part-027', 'u-part-028', 'u-part-029', 'u-part-030'],
  },
  'g-batch-d': {
    participant_ids: ['u-part', 'u-part-005', 'u-part-011', 'u-part-021', 'u-part-025'],
  },
};
