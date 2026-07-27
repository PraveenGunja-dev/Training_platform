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
 * SUB_MENTOR: true when the resource's group_id is one of their assigned groups.
 *   For 'document' + 'delete'/'edit': also requires uploaded_by_id === current user id.
 *   When read_only=true (cross-visibility non-assigned class), always false for writes.
 * PARTICIPANT: always false for write actions on this surface.
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

  // LEAD_MENTOR can manage participants, sub_mentors, and sub-groups within their assigned group
  if (user?.role === 'LEAD_MENTOR' && user.lead_mentor_of_group_ids && user.lead_mentor_of_group_ids.length > 0) {
    const adminGroupIds = new Set(user.lead_mentor_of_group_ids);
    if (action === 'create') return true;
    if (!resourceData?.group_id) return false;
    return adminGroupIds.has(resourceData.group_id);
  }

  return false;
}
