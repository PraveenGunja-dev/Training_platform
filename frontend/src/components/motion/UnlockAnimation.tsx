import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LockOpen } from 'lucide-react';
import { useState, useEffect } from 'react';

export function UnlockAnimation({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (active && !unlocked) {
      const t = setTimeout(() => {
        setUnlocked(true);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [active, unlocked, onComplete]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Pulse rings */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute h-12 w-12 rounded-full border-2 border-brand-electric"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.5, delay: i * 0.2, ease: 'easeOut' }}
        />
      ))}
      {/* Icon swap */}
      <AnimatePresence mode="wait">
        {!unlocked ? (
          <motion.div
            key="lock"
            initial={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: -90 }}
            transition={{ duration: 0.2 }}
          >
            <Lock className="h-6 w-6 text-foreground/40" />
          </motion.div>
        ) : (
          <motion.div
            key="unlock"
            initial={{ opacity: 0, rotate: 90 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LockOpen className="h-6 w-6 text-brand-teal" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
