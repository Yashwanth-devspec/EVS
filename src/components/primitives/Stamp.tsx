import React from 'react';
import { motion } from 'motion/react';

interface StampProps {
  label?: string;
  variant?: 'green' | 'amber' | 'ink';
  className?: string;
}

export const Stamp: React.FC<StampProps> = ({
  label = 'CONFIRMED',
  variant = 'green',
  className = '',
}) => {
  const colorMap = {
    green: 'border-green-ink text-green-ink',
    amber: 'border-amber-ink text-amber-ink',
    ink: 'border-on-paper text-on-paper',
  };

  return (
    <motion.div
      initial={{ scale: 1.12, opacity: 0, rotate: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`inline-block px-3 py-1 border-2 border-dashed uppercase font-cockpit font-bold text-sm tracking-widest select-none ${colorMap[variant]} ${className}`}
      style={{
        borderColor: variant === 'green' ? '#0B7A4B' : variant === 'amber' ? '#8A5A00' : '#0E1210',
        color: variant === 'green' ? '#0B7A4B' : variant === 'amber' ? '#8A5A00' : '#0E1210',
      }}
      aria-label={`Status stamp: ${label}`}
    >
      {label}
    </motion.div>
  );
};
