import React from 'react';

/** Line icons (24px grid, 1.75 stroke). Used only where the icon carries meaning. */
const Svg: React.FC<{ size?: number; children: React.ReactNode; className?: string }> = ({ size = 18, children, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {children}
  </svg>
);

type P = { size?: number; className?: string };

export const IconPin: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);

export const IconLink: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7.4l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
    <path d="M14 10.5a4 4 0 0 0-5.7-.4l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4" />
  </Svg>
);

export const IconLock: React.FC<P> = (p) => (
  <Svg size={14} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const IconSearch: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);

export const IconPlane: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </Svg>
);

export const IconCopy: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Svg>
);

export const IconPhone: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Svg>
);

export const IconShare: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Svg>
);

export const IconCheck: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconClock: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconCar: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 16V11l2-5h10l2 5v5" />
    <path d="M3 16h18v3H3z" />
    <circle cx="7.5" cy="19" r="1.5" />
    <circle cx="16.5" cy="19" r="1.5" />
  </Svg>
);

export const IconShield: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const IconChevron: React.FC<P & { up?: boolean }> = ({ up, ...p }) => (
  <Svg {...p}>
    <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
  </Svg>
);

export const IconRupee: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M7 4h10M7 8.5h10M14 4c3 0 3 9-3 9H7l7 7" />
  </Svg>
);

export const IconLeaf: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
    <path d="M5 19 13 11" />
  </Svg>
);

export const IconUsers: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14a5.5 5.5 0 0 1 3 5" />
  </Svg>
);

export const IconMessage: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);

export const IconSend: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="m22 2-11 11" />
    <path d="M22 2 15 22l-4-9-9-4 20-9z" />
  </Svg>
);
