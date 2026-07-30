import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/lib/types';

export interface ClassFeedback {
  id: string;
  class_session_id: string;
  rating: number;
  comment: string;
  submitted_at: string;
}

export const feedbackApi = {
  submit: (classId: string, rating: number, comment: string) =>
    apiClient
      .post<ApiEnvelope<ClassFeedback>>('/feedback/submit/', {
        class_session_id: classId,
        rating,
        comment,
      })
      .then(r => r.data),

  getMy: (classId: string) =>
    apiClient
      .get<ApiEnvelope<ClassFeedback | null>>('/feedback/my/', {
        params: { class_id: classId },
      })
      .then(r => r.data),
};
