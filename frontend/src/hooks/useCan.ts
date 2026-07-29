import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { subMentorApi } from '@/api/subMentor';

export type CanAction =
  | 'edit' | 'create' | 'delete' | 'approve' | 'publish'
  | 'start_session' | 'end_session';

export type CanResource =
  | 'class' | 'assignment' | 'submission' | 'document'
  | 'attendance_session' | 'shared_upload' | 'group';

export interface CanResourceData {
  group_id?: string;
  uploaded_by_id?: string;
  read_only?: boolean;
}

/**
 * Returns true if the current user can perform action on a resource.
 *
 * ADMIN: always true.
 * LEAD_MENTOR and SUB_MENTOR: identical logic, scoped to their assigned groups.
 *   Both roles:
 *   - read_only=true blocks all write actions
 *   - create requires at least 1 assigned group
 *   - all other actions require group_id to be in their assigned groups
 *   - document delete/edit additionally requires uploaded_by_id === user.id
 * PARTICIPANT and others: always false for write actions.
 */
export function useCan(
  action: CanAction,
  _resource: CanResource,
  resourceData?: CanResourceData,
): boolean {
  const { user } = useAuthStore();

  const { data: myGroupIds } = useQuery({
    queryKey: ['subMentor', 'my-group-ids'],
    queryFn: subMentorApi.myGroupIds,
    enabled: user?.role === 'SUB_MENTOR',
    staleTime: 60_000,
  });

  if (user?.role === 'ADMIN') return true;

  if (user?.role === 'SUB_MENTOR') {
    // Cross-visibility read-only: never allow writes on non-assigned classes
    if (resourceData?.read_only === true) return false;

    if (!myGroupIds) return false;

    // For create: subMentor can create if they have at least one assigned group
    if (action === 'create') return (myGroupIds?.length ?? 0) > 0;

    const inGroup = resourceData?.group_id
      ? myGroupIds instanceof Set
        ? myGroupIds.has(resourceData.group_id)
        : myGroupIds?.includes(resourceData.group_id) ?? false
      : false;
    if (!inGroup) return false;

    // Delete/edit on documents: subMentor can only act on their own uploads
    if (_resource === 'document' && (action === 'delete' || action === 'edit')) {
      return resourceData?.uploaded_by_id === user.id;
    }
    return true;
  }

  if (user?.role === 'LEAD_MENTOR') {
    const leadGroupIds = user.lead_mentor_of_group_ids;
    if (!leadGroupIds || leadGroupIds.length === 0) return false;

    // Cross-visibility read-only: never allow writes on non-assigned classes
    if (resourceData?.read_only === true) return false;

    if (action === 'create') return leadGroupIds.length > 0;

    if (!resourceData?.group_id) return false;
    const inGroup = new Set(leadGroupIds).has(resourceData.group_id);
    if (!inGroup) return false;

    // Delete/edit on documents: same restriction as Sub-Mentor — own uploads only
    if (_resource === 'document' && (action === 'delete' || action === 'edit')) {
      return resourceData?.uploaded_by_id === user.id;
    }
    return true;
  }

  return false;
}
