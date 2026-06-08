import { z } from 'zod';

export const DOC_TYPES = [
  { value: 'SLIDES',     label: 'Slides'            },
  { value: 'GUIDE',      label: 'Guide'             },
  { value: 'TEMPLATE',   label: 'Template'          },
  { value: 'REPORT',     label: 'Report'            },
  { value: 'REFERENCE',  label: 'Reference Material'},
  { value: 'QUIZ',       label: 'Quiz'              },
  { value: 'SCHEDULE',   label: 'Schedule'          },
  { value: 'CASE_STUDY', label: 'Case Study'        },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: 'GROUP',           label: 'All Group Participants',     desc: 'Every participant in the selected group can see this.' },
  { value: 'PUBLIC_TO_CLASS', label: 'Public to Assigned Class',   desc: 'Only participants in the linked class session.'        },
  { value: 'SELECTED',        label: 'Selected Participants Only', desc: 'Choose specific participants below.'                   },
  { value: 'STAFF_ONLY',      label: 'Admin Only',                 desc: 'Hidden from all participants.'                        },
] as const;

// File is managed outside the form (local state), schema only covers metadata
export const documentSchema = z.object({
  group_id:        z.string().min(1, 'Group is required'),
  class_id:        z.string().optional(),
  title:           z.string().min(2, 'Title must be at least 2 characters'),
  description:     z.string().optional(),
  doc_type:        z.string().min(1, 'Document type is required'),
  visibility:      z.enum(['GROUP', 'SELECTED', 'STAFF_ONLY', 'PUBLIC_TO_CLASS']),
  allowed_user_ids:z.array(z.string()).optional(),
}).refine(
  d => d.visibility !== 'SELECTED' || (d.allowed_user_ids && d.allowed_user_ids.length > 0),
  { path: ['allowed_user_ids'], message: 'Select at least one participant' },
);

export type DocumentFormValues = z.infer<typeof documentSchema>;
