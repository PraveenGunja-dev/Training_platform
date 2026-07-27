import { apiClient } from '@/lib/api-client';

export interface SubMentorGroup {
  id: string;
  name: string;
  participant_count: number;
}

export interface MyGroupsResponse {
  data: SubMentorGroup[];
  effective_can_view_all: boolean;
}

export const subMentorApi = {
  myGroups: (): Promise<MyGroupsResponse> =>
    apiClient.get<MyGroupsResponse>('/me/groups').then(r => r.data),

  /** Convenience: returns the array of group IDs assigned to the subMentor. */
  myGroupIds: async (): Promise<string[]> => {
    const res = await apiClient.get<MyGroupsResponse>('/me/groups');
    return res.data.data.map(g => g.id);
  },
};
