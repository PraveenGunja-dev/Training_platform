import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { forwardRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionWrapper = motion(Button as any);

export const MotionButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <MotionWrapper
    ref={ref}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
    {...props}
  />
));
MotionButton.displayName = 'MotionButton';
