import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface DigitRollProps {
  value: number | string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const DigitRoll: React.FC<DigitRollProps> = ({
  value,
  className = '',
  prefix = '',
  suffix = '',
}) => {
  const isFirstRender = useRef(true);
  const [prevVal, setPrevVal] = useState(value);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPrevVal(value);
  }, [value]);

  return (
    <span className={`inline-flex items-baseline font-sans tabular-nums ${className}`}>
      {prefix && <span className="mr-0.5">{prefix}</span>}
      <span className="relative inline-block overflow-hidden h-[1.15em] align-top">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={String(value)}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
};
