import { http, HttpResponse } from 'msw';
import { documentsData, sharedUploadsData } from '../data/documents';
import { usersData } from '../data/users';
import { groupMemberships } from '../data/groups';
import { mockAuthState } from '../data/seed';
import { notificationsData } from '../data/notifications';
import type { Document, ParticipantSharedDoc } from '@/lib/types';

export const documentsHandlers = [
  http.get('*/api/v1/documents', ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('filter[group_id]') ?? url.searchParams.get('group_id');
    const docType = url.searchParams.get('filter[doc_type]') ?? url.searchParams.get('doc_type');
    const search = url.searchParams.get('search')?.toLowerCase();

    const userId = mockAuthState.currentUserId;
    const user = usersData.find(u => u.id === userId);

    let items = [...documentsData];

    if (user?.role === 'PARTICIPANT') {
      const userGroupIds = Object.entries(groupMemberships)
        .filter(([, m]) => m.participant_ids.includes(userId))
        .map(([id]) => id);
      items = items.filter(d => {
        if (!userGroupIds.includes(d.group_id)) return false;
        if (d.visibility === 'STAFF_ONLY') return false;
        if (d.visibility === 'SELECTED') return d.allowed_user_ids.includes(userId);
        return true;
      });
    }
    // ADMIN sees all documents

    if (groupId) items = items.filter(d => d.group_id === groupId);
    if (docType) items = items.filter(d => d.doc_type === docType);
    if (search) items = items.filter(d => d.title.toLowerCase().includes(search));

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.get('*/api/v1/documents/:id', ({ params }) => {
    const doc = documentsData.find(d => d.id === params.id);
    return doc
      ? HttpResponse.json({ data: doc })
      : HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Document not found.' }] }, { status: 404 });
  }),

  http.post('*/api/v1/documents', async ({ request }) => {
    const contentType = request.headers.get('content-type') ?? '';
    const userId = mockAuthState.currentUserId;
    let groupId = '';
    let classId: string | null = null;
    let title = 'Untitled Document';
    let description = '';
    let docType = 'SLIDES';
    let visibility = 'GROUP';
    let allowedUserIds: string[] = [];
    let fileName = 'upload.pdf';
    let fileSize = 102400;
    let fileType = 'application/pdf';

    if (contentType.includes('multipart')) {
      try {
        const formData = await request.formData();
        groupId = (formData.get('group_id') as string | null) ?? '';
        classId = (formData.get('class_id') as string | null) ?? null;
        title = (formData.get('title') as string | null) ?? 'Untitled Document';
        description = (formData.get('description') as string | null) ?? '';
        docType = (formData.get('doc_type') as string | null) ?? 'SLIDES';
        visibility = (formData.get('visibility') as string | null) ?? 'GROUP';
        const allowedRaw = formData.get('allowed_user_ids') as string | null;
        if (allowedRaw) {
          try { allowedUserIds = JSON.parse(allowedRaw) as string[]; } catch { /* ignore */ }
        }
        const fileField = formData.get('file');
        if (fileField instanceof File) {
          fileName = fileField.name;
          fileSize = fileField.size || fileSize;
          fileType = fileField.type || 'application/octet-stream';
        }
      } catch { /* fall through with defaults */ }
    }

    const newDoc: Document = {
      id: 'doc-' + Math.random().toString(36).slice(2, 8),
      group_id: groupId, class_id: classId,
      title,
      description,
      file_url: `mock://documents/${fileName}`, file_name: fileName, file_type: fileType, file_size: fileSize,
      doc_type: docType, visibility: visibility as Document['visibility'],
      allowed_user_ids: allowedUserIds, uploaded_by_id: userId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    documentsData.push(newDoc);
    return HttpResponse.json({ data: newDoc }, { status: 201 });
  }),

  http.patch('*/api/v1/documents/:id', async ({ request, params }) => {
    const idx = documentsData.findIndex(d => d.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Document not found.' }] }, { status: 404 });
    const body = await request.json() as Partial<Document>;
    documentsData[idx] = { ...documentsData[idx], ...body };
    return HttpResponse.json({ data: documentsData[idx] });
  }),

  http.delete('*/api/v1/documents/:id', ({ params }) => {
    const idx = documentsData.findIndex(d => d.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Document not found.' }] }, { status: 404 });
    documentsData.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Download document file — returns a stub blob in mock mode
  http.get('*/api/v1/documents/:id/file', ({ params }) => {
    const doc = documentsData.find(d => d.id === params.id);
    if (!doc) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Document not found.' }] }, { status: 404 });
    return new HttpResponse(new Blob(['mock document file content'], { type: doc.file_type || 'application/octet-stream' }), {
      headers: { 'Content-Disposition': `attachment; filename="${doc.file_name || doc.title}"` },
    });
  }),

  // Download shared upload file — returns a stub blob in mock mode
  http.get('*/api/v1/shared-uploads/:id/file', ({ params }) => {
    const upload = sharedUploadsData.find(s => s.id === params.id);
    if (!upload) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Shared upload not found.' }] }, { status: 404 });
    return new HttpResponse(new Blob(['mock shared file content'], { type: upload.file_type || 'application/octet-stream' }), {
      headers: { 'Content-Disposition': `attachment; filename="${upload.file_name}"` },
    });
  }),

  // Shared uploads
  http.post('*/api/v1/groups/:groupId/shared-uploads', async ({ params, request }) => {
    const userId = mockAuthState.currentUserId;
    const user = usersData.find(u => u.id === userId);
    let title = user?.full_name ? `Upload by ${user.full_name}` : 'Shared Upload';
    let suggestedVisibility = 'GROUP';
    let suggestedUserIds: string[] = [];
    let fileName = 'shared-upload.pdf';
    let fileSize = 204800;
    let fileType = 'application/pdf';

    try {
      const formData = await request.formData();
      title = (formData.get('title') as string | null) ?? title;
      suggestedVisibility = (formData.get('suggested_visibility') as string | null) ?? suggestedVisibility;
      const idsRaw = formData.get('suggested_user_ids') as string | null;
      if (idsRaw) {
        try { suggestedUserIds = JSON.parse(idsRaw) as string[]; } catch { /* ignore */ }
      }
      const fileField = formData.get('file');
      if (fileField instanceof File) {
        fileName = fileField.name;
        fileSize = fileField.size || fileSize;
        fileType = fileField.type || 'application/octet-stream';
      }
    } catch { /* fall through with defaults */ }

    const newUpload: ParticipantSharedDoc = {
      id: 'shared-' + Math.random().toString(36).slice(2, 8),
      group_id: params.groupId as string,
      uploaded_by_id: userId,
      title,
      file_url: `mock://shared/${fileName}`,
      file_name: fileName, file_size: fileSize, file_type: fileType,
      suggested_visibility: suggestedVisibility, suggested_user_ids: suggestedUserIds,
      status: 'PENDING', reviewed_by_id: null, reviewed_at: null, rejection_reason: null, resulting_document_id: null,
      created_at: new Date().toISOString(),
    };
    sharedUploadsData.push(newUpload);
    return HttpResponse.json({ data: newUpload }, { status: 202 });
  }),

  http.get('*/api/v1/shared-uploads/pending', ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('group_id');

    let items = sharedUploadsData.filter(s => s.status === 'PENDING');

    if (groupId) items = items.filter(s => s.group_id === groupId);

    return HttpResponse.json({ data: items, meta: { total: items.length } });
  }),

  http.post('*/api/v1/shared-uploads/:id/approve', async ({ request, params }) => {
    const idx = sharedUploadsData.findIndex(s => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Shared upload not found.' }] }, { status: 404 });
    const body = await request.json() as { visibility?: string; allowed_user_ids?: string[]; note?: string };
    const reviewerId = mockAuthState.currentUserId;

    sharedUploadsData[idx] = {
      ...sharedUploadsData[idx],
      status: 'APPROVED', reviewed_by_id: reviewerId, reviewed_at: new Date().toISOString(),
    };
    const upload = sharedUploadsData[idx];

    documentsData.push({
      id: 'doc-shared-' + params.id,
      group_id: upload.group_id, class_id: null,
      title: upload.title || upload.file_name,
      description: '',
      file_url: upload.file_url, file_name: upload.file_name, file_type: upload.file_type, file_size: upload.file_size,
      doc_type: 'SHARED', visibility: (body.visibility as Document['visibility']) ?? 'GROUP',
      allowed_user_ids: body.allowed_user_ids ?? [],
      uploaded_by_id: upload.uploaded_by_id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });

    // Notify uploader
    notificationsData.push({
      id: 'notif-approve-' + params.id,
      user_id: upload.uploaded_by_id,
      type: 'SHARED_DOC_RESULT',
      channel: 'IN_APP',
      title: 'Your Upload Was Approved',
      body: `Your shared document "${upload.title || upload.file_name}" has been approved and is now visible to the group.`,
      link: '/me/documents',
      read_at: null,
      created_at: new Date().toISOString(),
    });

    return HttpResponse.json({ data: sharedUploadsData[idx] });
  }),

  http.post('*/api/v1/shared-uploads/:id/reject', async ({ request, params }) => {
    const idx = sharedUploadsData.findIndex(s => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ data: null, errors: [{ code: 'not_found', message: 'Shared upload not found.' }] }, { status: 404 });
    const body = await request.json() as { reason: string };
    const reviewerId = mockAuthState.currentUserId;

    sharedUploadsData[idx] = {
      ...sharedUploadsData[idx],
      status: 'REJECTED', reviewed_by_id: reviewerId,
      reviewed_at: new Date().toISOString(), rejection_reason: body.reason,
    };
    const upload = sharedUploadsData[idx];

    // Notify uploader
    notificationsData.push({
      id: 'notif-reject-' + params.id,
      user_id: upload.uploaded_by_id,
      type: 'SHARED_DOC_RESULT',
      channel: 'IN_APP',
      title: 'Your Upload Was Rejected',
      body: `Your shared document "${upload.title || upload.file_name}" was rejected. Reason: ${body.reason}`,
      link: '/me/documents',
      read_at: null,
      created_at: new Date().toISOString(),
    });

    return HttpResponse.json({ data: sharedUploadsData[idx] });
  }),
];
