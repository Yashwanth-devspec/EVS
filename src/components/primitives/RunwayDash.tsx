import React from 'react';

interface RunwayDashProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  animate?: boolean;
}

export const RunwayDash: React.FC<RunwayDashProps> = ({
  orientation = 'horizontal',
  className = '',
  animate = false,
}) => {
  if (orientation === 'vertical') {
    return (
      <div
        className={`w-0 border-l-2 border-dashed border-amber opacity-75 ${
          animate ? 'animate-pulse' : ''
        } ${className}`}
        style={{ borderColor: '#FFB020' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`w-full h-0 border-t-2 border-dashed border-amber opacity-75 ${
        animate ? 'animate-pulse' : ''
      } ${className}`}
      style={{ borderColor: '#FFB020' }}
      aria-hidden="true"
    />
  );
};
