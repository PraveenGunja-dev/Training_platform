import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { MotionButton } from '@/components/motion/MotionButton';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center p-12 text-center"
      role="status"
    >
      {icon && (
        <div className="mb-4 rounded-full bg-brand-electric/10 p-4 border border-white/10">
          <div className="text-brand-electric">{icon}</div>
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-foreground/60 max-w-sm">{description}</p>
      )}
      {action && (
        <MotionButton onClick={action.onClick} variant="outline" size="sm" className="mt-4">
          {action.label}
        </MotionButton>
      )}
    </motion.div>
  );
}
