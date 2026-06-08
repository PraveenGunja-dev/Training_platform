import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, Document, ParticipantSharedDoc, UploadPermission } from '@/lib/types';

export const documentsApi = {
  list: (params?: { group_id?: string; doc_type?: string; search?: string; sort?: string }) =>
    apiClient.get<ApiEnvelope<Document[]>>('/documents', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<Document>>(`/documents/${id}`).then(r => r.data),
  getUploadUrl: (filename: string, content_type: string) =>
    apiClient.post<ApiEnvelope<{ upload_url: string; blob_name: string }>>('/documents/upload-url', { filename, content_type }).then(r => r.data),
  create: (body: FormData | Record<string, unknown>) =>
    apiClient.post<ApiEnvelope<Document>>('/documents', body).then(r => r.data),
  update: (id: string, body: Partial<Document>) =>
    apiClient.patch<ApiEnvelope<Document>>(`/documents/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/documents/${id}`),
  // Participant shared upload
  uploadPermissions: () =>
    apiClient.get<ApiEnvelope<UploadPermission[]>>('/me/upload-permissions').then(r => r.data),
  mySharedUploads: () =>
    apiClient.get<ApiEnvelope<ParticipantSharedDoc[]>>('/me/shared-uploads').then(r => r.data),
  getSharedUploadUrl: (groupId: string, filename: string, content_type: string) =>
    apiClient.post<ApiEnvelope<{ upload_url: string; blob_name: string }>>(`/groups/${groupId}/shared-upload-url`, { filename, content_type }).then(r => r.data),
  submitSharedUpload: (groupId: string, body: FormData | Record<string, unknown>) =>
    apiClient.post<ApiEnvelope<ParticipantSharedDoc>>(`/groups/${groupId}/shared-uploads`, body).then(r => r.data),
  // Admin shared upload management
  pendingSharedUploads: () =>
    apiClient.get<ApiEnvelope<ParticipantSharedDoc[]>>('/admin/shared-uploads/pending').then(r => r.data),
  approveSharedUpload: (id: string, body: { visibility: string; allowed_user_ids?: string[] }) =>
    apiClient.post(`/admin/shared-uploads/${id}/approve`, body).then(r => r.data),
  rejectSharedUpload: (id: string, body: { reason: string }) =>
    apiClient.post(`/admin/shared-uploads/${id}/reject`, body).then(r => r.data),
};
