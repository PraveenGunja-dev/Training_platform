import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { instructorApi } from '@/api/instructor';

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
 * INSTRUCTOR: true when the resource's group_id is one of their assigned groups.
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
    queryKey: ['instructor', 'my-group-ids'],
    queryFn: instructorApi.myGroupIds,
    enabled: user?.role === 'INSTRUCTOR',
    staleTime: 60_000,
  });

  if (user?.role === 'ADMIN') return true;

  if (user?.role === 'INSTRUCTOR') {
    // Cross-visibility read-only: never allow writes on non-assigned classes
    if (resourceData?.read_only === true) return false;

    if (!myGroupIds) return false;

    // For create: instructor can create if they have at least one assigned group
    if (action === 'create') return myGroupIds.size > 0;

    const inGroup = resourceData?.group_id
      ? myGroupIds.has(resourceData.group_id)
      : false;
    if (!inGroup) return false;

    // Delete/edit on documents: instructor can only act on their own uploads
    if (_resource === 'document' && (action === 'delete' || action === 'edit')) {
      return resourceData?.uploaded_by_id === user.id;
    }
    return true;
  }

  return false;
}
