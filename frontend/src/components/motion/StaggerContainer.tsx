import { motion } from 'framer-motion';
import { staggerContainer } from './variants';

export function StaggerContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerContainer} initial="initial" animate="enter">
      {children}
    </motion.div>
  );
}
