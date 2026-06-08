import type { ClassStatus } from '@/lib/types';

interface EventColors {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

export function getEventColors(status: ClassStatus | string): EventColors {
  switch (status) {
    case 'UPCOMING':
      return { backgroundColor: '#4F46E5', borderColor: '#4338CA', textColor: '#ffffff' };
    case 'ONGOING':
      return { backgroundColor: '#059669', borderColor: '#047857', textColor: '#ffffff' };
    case 'COMPLETED':
      return { backgroundColor: '#64748B', borderColor: '#475569', textColor: '#ffffff' };
    case 'CANCELLED':
      return { backgroundColor: '#E11D48', borderColor: '#BE123C', textColor: '#ffffff' };
    default:
      return { backgroundColor: '#4F46E5', borderColor: '#4338CA', textColor: '#ffffff' };
  }
}
