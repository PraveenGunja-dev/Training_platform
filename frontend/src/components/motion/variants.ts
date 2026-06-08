import { Variants } from 'framer-motion';

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

export const staggerContainer: Variants = {
  initial: {},
  enter:   { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

export const tableStagger: Variants = {
  initial: {},
  enter:   { transition: { staggerChildren: 0.04 } },
};

export const tableRow: Variants = {
  initial: { opacity: 0, x: -8 },
  enter:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};
