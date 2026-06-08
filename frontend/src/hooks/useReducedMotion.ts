import { useReducedMotion as fmReducedMotion } from 'framer-motion';

export function useReducedMotion(): boolean {
  return fmReducedMotion() ?? false;
}
