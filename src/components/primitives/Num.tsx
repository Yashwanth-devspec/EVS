import React from 'react';

interface NumProps {
  value: number | string;
  className?: string;
  prefix?: string;
  suffix?: string;
  ariaLabel?: string;
}

/**
 * Num — Centralized component for rendering numerals, currencies, and timestamps.
 * Uses proportional typography (Bricolage Grotesque) with tabular figures (tabular-nums),
 * eliminating monospace kerning gaps while keeping numerals aligned.
 *
 * Monospace is reserved exclusively for flight codes (e.g. 6E 2134) and 4-digit pickup codes.
 */
export const Num: React.FC<NumProps> = ({
  value,
  className = '',
  prefix = '',
  suffix = '',
  ariaLabel,
}) => {
  return (
    <span
      className={`font-sans tabular-nums inline-inline tracking-normal ${className}`}
      aria-label={ariaLabel}
      style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
    >
      {prefix && <span>{prefix}</span>}
      <span>{value}</span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
};
