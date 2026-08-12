import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/lib/types';

export interface ClassFeedback {
  id: string;
  class_session_id: string;
  rating: number;
  comment: string;
  submitted_at: string;
}

export interface FeedbackListItem {
  id: string;
  participant_name: string;
  rating: number;
  comment: string;
  submitted_at: string;
}

export interface PerBatchFeedback {
  batch_id: string;
  batch_name: string;
  avg_rating: number;
  total_feedbacks: number;
  response_rate: number;
}

export interface RatingBucket {
  bucket: string;
  count: number;
}

export interface ClassRatingItem {
  class_id: string;
  class_name: string;
  batch_name: string;
  avg_rating: number;
}

export interface FeedbackAnalyticsResponse {
  per_batch_avg: PerBatchFeedback[];
  rating_distribution: RatingBucket[];
  top_classes: ClassRatingItem[];
  bottom_classes: ClassRatingItem[];
  avg_rating_over_time: Array<{ date: string; avg: number | null }>;
  overall_avg: number;
  total_feedbacks: number;
}

export interface FeedbackAnalyticsFilters {
  batch_id?: string;
  class_id?: string;
  mentor_id?: string;
  date_from?: string;
  date_to?: string;
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

  list: (classId: string) =>
    apiClient
      .get<ApiEnvelope<FeedbackListItem[]>>('/feedback/list/', {
        params: { class_id: classId },
      })
      .then(r => r.data),

  analytics: (filters?: FeedbackAnalyticsFilters) =>
    apiClient
      .get<ApiEnvelope<FeedbackAnalyticsResponse>>('/feedback/analytics/', { params: filters })
      .then(r => r.data),
};
