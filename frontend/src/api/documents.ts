import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, Document, ParticipantSharedDoc, UploadPermission } from '@/lib/types';

// Helper to trigger browser file download from a Blob
function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export const documentsApi = {
  list: (params?: { group_id?: string; doc_type?: string; search?: string; sort?: string }) =>
    apiClient.get<ApiEnvelope<Document[]>>('/documents', { params }).then(r => r.data),
  get: (id: string) =>
    apiClient.get<ApiEnvelope<Document>>(`/documents/${id}`).then(r => r.data),
  // Upload document: send file + metadata as multipart
  create: (formData: FormData) =>
    apiClient.post<ApiEnvelope<Document>>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  update: (id: string, body: Partial<Document>) =>
    apiClient.patch<ApiEnvelope<Document>>(`/documents/${id}`, body).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/documents/${id}`),
  // Download document: streams binary, triggers browser download
  download: async (id: string, filename: string): Promise<void> => {
    const response = await apiClient.get(`/documents/${id}/file`, { responseType: 'blob' });
    triggerDownload(response.data as Blob, filename);
  },
  // Participant shared upload
  uploadPermissions: () =>
    apiClient.get<ApiEnvelope<UploadPermission[]>>('/me/upload-permissions').then(r => r.data),
  mySharedUploads: () =>
    apiClient.get<ApiEnvelope<ParticipantSharedDoc[]>>('/me/shared-uploads').then(r => r.data),
  // submitSharedUpload: send file + metadata as multipart
  submitSharedUpload: (groupId: string, formData: FormData) =>
    apiClient.post<ApiEnvelope<ParticipantSharedDoc>>(`/groups/${groupId}/shared-uploads`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  // Admin shared upload management
  pendingSharedUploads: () =>
    apiClient.get<ApiEnvelope<ParticipantSharedDoc[]>>('/admin/shared-uploads/pending').then(r => r.data),
  approveSharedUpload: (id: string, body: { visibility: string; allowed_user_ids?: string[] }) =>
    apiClient.post(`/admin/shared-uploads/${id}/approve`, body).then(r => r.data),
  rejectSharedUpload: (id: string, body: { reason: string }) =>
    apiClient.post(`/admin/shared-uploads/${id}/reject`, body).then(r => r.data),
  deleteSharedUpload: (id: string) =>
    apiClient.delete(`/admin/shared-uploads/${id}`),
  // Download shared upload file
  downloadSharedUpload: async (id: string, filename: string): Promise<void> => {
    const response = await apiClient.get(`/shared-uploads/${id}/file`, { responseType: 'blob' });
    triggerDownload(response.data as Blob, filename);
  },
};
