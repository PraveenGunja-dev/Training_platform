/* Shared chart design tokens — all charts import from here */

export const C = {
  indigo:  '#4F46E5',
  violet:  '#7C3AED',
  cyan:    '#06B6D4',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#F43F5E',
  sky:     '#0EA5E9',
  orange:  '#F97316',
  slate:   '#64748B',
} as const;

/** Ordered palette for multi-series charts */
export const PALETTE = [C.indigo, C.emerald, C.amber, C.rose, C.cyan, C.violet, C.orange, C.sky];

/** Light-mode grid / axis colours */
export const GRID_COLOR = '#E0DDFA';
export const AXIS_TICK  = { fontSize: 11, fill: '#7C7AAE' };
