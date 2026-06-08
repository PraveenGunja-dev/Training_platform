export const srOnly = 'sr-only' as const;
export const visuallyHidden = srOnly;

export function makeId(...parts: (string | number)[]): string {
  return parts.join('-');
}
