import { apiClient } from '@/lib/api-client';

export interface InstructorGroup {
  id: string;
  name: string;
  participant_count: number;
}

export interface MyGroupsResponse {
  data: InstructorGroup[];
  effective_can_view_all: boolean;
}

export const instructorApi = {
  myGroups: (): Promise<MyGroupsResponse> =>
    apiClient.get<MyGroupsResponse>('/me/groups').then(r => r.data),

  /** Convenience: returns the set of group IDs assigned to the instructor. */
  myGroupIds: async (): Promise<Set<string>> => {
    const res = await apiClient.get<MyGroupsResponse>('/me/groups');
    return new Set(res.data.data.map(g => g.id));
  },
};
