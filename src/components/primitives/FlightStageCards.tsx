import React from 'react';

interface Stage {
  number: string;
  tag: string;
  title: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
}

export const FlightStageCards: React.FC = () => {
  const stages: Stage[] = [
    {
      number: '01',
      tag: 'TOUCHDOWN CHECK-IN',
      title: 'Where & When',
      description: 'Select your drop neighborhood and touchdown quarter-hour. No passwords, no credit cards, no phone numbers.',
      detail: 'Estimated exit buffer: 15m cabin bag, 30m checked luggage.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      ),
    },
    {
      number: '02',
      tag: 'RADAR MATCHING',
      title: 'Corridor Lock',
      description: 'Our matching engine groups 2 to 4 travellers landing on the same 15-minute flight wave heading down the same expressway corridor.',
      detail: 'Shows exactly who is sharing, stops along the route, and prorated rupees.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m16.2 7.8-2 6.3-6.4 2 2-6.3z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ),
    },
    {
      number: '03',
      tag: 'CURB HANDSHAKE',
      title: 'Meet at Pillar',
      description: 'Walk to the designated pickup curb (e.g. Lane 2, Pillar 4). Everyone matches a synchronized 4-digit code on their boarding pass before boarding.',
      detail: 'One rider books a regular Uber, Ola, or Rapido with pre-filled stops.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M7 7h.01" />
          <path d="M17 7h.01" />
          <path d="M7 17h.01" />
          <path d="M17 17h.01" />
          <path d="m10 10 4 4" />
          <path d="m14 10-4 4" />
        </svg>
      ),
    },
    {
      number: '04',
      tag: 'UPI PRORATION',
      title: 'Settle at Drop',
      description: 'Fixed airport fees and highway tolls are split evenly. Road distance is prorated to your drop km. Co-passengers pay the booker directly via UPI.',
      detail: '0% platform cut. All trip data automatically purges in 24 hours.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stages.map((s) => (
        <div
          key={s.number}
          className="group relative rounded-2xl border border-ink-800 bg-ink-900/60 p-6 backdrop-blur transition-all duration-300 hover:border-amber/50 hover:bg-ink-900 hover:-translate-y-1 overflow-hidden"
        >
          {/* Subtle runway dash highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Header with Stage Number & Icon */}
          <div className="flex items-center justify-between pb-4 border-b border-ink-800">
            <span className="font-cockpit text-3xl font-extrabold text-amber/80 group-hover:text-amber transition-colors">
              {s.number}
            </span>
            <div className="h-10 w-10 rounded-xl bg-ink-950 border border-ink-800 flex items-center justify-center text-secondary group-hover:text-amber group-hover:border-amber/30 transition-all">
              {s.icon}
            </div>
          </div>

          <div className="pt-4 space-y-2">
            <span className="font-cockpit text-[11px] font-bold tracking-wider text-secondary block">
              {s.tag}
            </span>
            <h3 className="text-xl font-bold text-primary tracking-tight">
              {s.title}
            </h3>
            <p className="text-secondary text-sm leading-relaxed">
              {s.description}
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-ink-800/60 font-cockpit text-xs text-secondary/70">
            {s.detail}
          </div>
        </div>
      ))}
    </div>
  );
};
