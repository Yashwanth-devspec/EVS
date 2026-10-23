import React from 'react';
import { navigate } from '../router';
import { Trip } from '../types';
import { formatTime } from '../utils';

export const Logo: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick ?? (() => navigate('/'))}
    className="flex items-center gap-2.5 rounded-lg py-1 pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
    aria-label="EcoRide Share home"
  >
    {/* Three routes merging into one */}
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M 4 8 C 14 8, 18 16, 28 16" stroke="#FFB020" />
      <path d="M 4 16 L 28 16" stroke="#ECEFEA" />
      <path d="M 4 24 C 14 24, 18 16, 28 16" stroke="#3DDC97" />
    </svg>
    <span className="whitespace-nowrap text-lg font-bold tracking-tight text-primary">
      EcoRide<span className="hidden font-medium text-secondary min-[400px]:inline"> Share</span>
    </span>
  </button>
);

export const DemoChip: React.FC = () => (
  <span className="demo-chip" title="All travellers, trips and totals in this build are demo data" data-demo="demo-chip">
    Demo data
  </span>
);

function tripChip(trip: Trip | null): string {
  const r = trip?.request;
  if (!r) return 'Bengaluru airport (BLR)';
  const flight = r.flight_no ? `${r.flight_no.replace(/^([A-Z0-9]{2})/, '$1 ')} · ` : '';
  return `${flight}lands ${formatTime(r.scheduled_arrival)} · ${r.area}`;
}

const NAV = [
  { path: '/trip', label: 'Trip' },
  { path: '/impact', label: 'Impact' },
  { path: '/help', label: 'Help' },
];

/** Top bar for the app pages. Always shows the brand, where you are, and the Demo data chip. */
export const AppHeader: React.FC<{ path: string; trip: Trip | null }> = ({ path, trip }) => (
  <header className="fixed inset-x-0 top-0 z-[900] h-14 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
    <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4">
      <Logo />
      <span className="hidden sm:block min-w-0 truncate text-sm text-secondary" data-demo="header-trip">
        {tripChip(trip)}
      </span>
      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-1" aria-label="App">
          {NAV.map((n) => (
            <button
              key={n.path}
              type="button"
              onClick={() => navigate(n.path)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                path === n.path || (n.path === '/trip' && path.startsWith('/j/')) ? 'bg-ink-800 text-primary' : 'text-secondary hover:text-primary'
              }`}
              aria-current={path === n.path ? 'page' : undefined}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <DemoChip />
      </div>
    </div>
  </header>
);

const NavIcon: React.FC<{ name: string }> = ({ name }) => {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'Trip')
    return (
      <svg {...common}>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    );
  if (name === 'Impact')
    return (
      <svg {...common}>
        <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
        <path d="M5 19 13 11" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.1-2.4 3.6" />
      <path d="M12 17h.01" />
    </svg>
  );
};

/** Phone bottom navigation: Trip, Impact, Help. Invites appear inside the Trip sheet, never on a tab. */
export const BottomNav: React.FC<{ path: string; tripNeedsYou: boolean }> = ({ path, tripNeedsYou }) => (
  <nav
    className="md:hidden fixed inset-x-0 bottom-0 z-[900] h-16 border-t border-ink-800 bg-ink-950 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]"
    aria-label="App"
  >
    {NAV.map((n) => {
      const on = path === n.path || (n.path === '/trip' && path.startsWith('/j/'));
      return (
        <button
          key={n.path}
          type="button"
          onClick={() => navigate(n.path)}
          className={`relative flex flex-col items-center justify-center gap-0.5 text-[13px] font-medium ${on ? 'text-primary' : 'text-secondary'}`}
          aria-current={on ? 'page' : undefined}
          data-demo={`nav-${n.label.toLowerCase()}`}
        >
          <span className={on ? 'text-amber' : ''}>
            <NavIcon name={n.label} />
          </span>
          {n.label}
          {n.path === '/trip' && tripNeedsYou && !on && <span className="absolute top-2 left-[calc(50%+8px)] h-2.5 w-2.5 rounded-full bg-amber" aria-label="Needs your reply" />}
        </button>
      );
    })}
  </nav>
);
