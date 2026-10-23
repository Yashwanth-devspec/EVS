import React, { useEffect, useState } from 'react';
import { chime } from '../../lib/chime';

interface FlightRow {
  flight: string;
  from: string;
  time: string;
  terminal: string;
  status: string;
  statusColor: 'green' | 'amber' | 'blue';
}

const FLIGHTS: FlightRow[] = [
  { flight: '6E 2134', from: 'DELHI (DEL)', time: '23:45', terminal: 'T1', status: 'LANDED', statusColor: 'green' },
  { flight: 'AI 506', from: 'MUMBAI (BOM)', time: '23:50', terminal: 'T2', status: 'BAGS ON BELT', statusColor: 'green' },
  { flight: 'UK 812', from: 'KOLKATA (CCU)', time: '23:55', terminal: 'T2', status: 'APPROACHING', statusColor: 'amber' },
  { flight: 'QP 1302', from: 'GOA (GOI)', time: '00:05', terminal: 'T1', status: 'ON TIME', statusColor: 'blue' },
  { flight: '6E 618', from: 'CHENNAI (MAA)', time: '00:15', terminal: 'T1', status: 'IN AIR', statusColor: 'amber' },
  { flight: 'IX 784', from: 'KOCHI (COK)', time: '00:25', terminal: 'T1', status: 'ON TIME', statusColor: 'blue' },
];

export const FlightArrivalsTicker: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFlipping(true);
      window.setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % FLIGHTS.length);
        setFlipping(false);
      }, 300);
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  const current = FLIGHTS[activeIdx];
  const next = FLIGHTS[(activeIdx + 1) % FLIGHTS.length];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-ink-800 bg-ink-950/90 shadow-2xl backdrop-blur-md">
      {/* Ticker Header */}
      <div className="flex items-center justify-between border-b border-ink-800/80 px-4 py-2 bg-ink-900/40 text-[11px] font-semibold text-secondary tracking-wider font-cockpit">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
          </span>
          <span>Live BLR arrival waves · Kempegowda Terminal 1 &amp; 2</span>
        </div>
        <button
          type="button"
          onClick={() => chime.playChime()}
          className="hover:text-primary transition-colors text-[10px] text-amber flex items-center gap-1 cursor-pointer"
          title="Play airport gate chime"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber inline-block" />
          Gate chime
        </button>
      </div>

      {/* Mechanical Board Display */}
      <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-3 p-3 sm:px-5 sm:py-3.5">
        {/* Flight Number Flap */}
        <div className="md:col-span-3 flex items-center gap-2">
          <div className="relative overflow-hidden rounded-md bg-ink-900 px-3 py-1.5 border border-ink-700/80 shadow-inner font-cockpit text-base sm:text-lg font-bold text-amber tracking-wider">
            <span className={`inline-block transition-transform duration-300 ${flipping ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
              {current.flight}
            </span>
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-ink-950/80 shadow-sm" />
          </div>
          <span className="rounded bg-ink-800/80 px-2 py-0.5 font-cockpit text-xs font-semibold text-primary border border-ink-700">
            {current.terminal}
          </span>
        </div>

        {/* Origin & Time */}
        <div className="md:col-span-6 flex items-center justify-between sm:justify-start gap-4">
          <div className="min-w-0">
            <span className="block text-[10px] text-secondary tracking-wider">Arriving from</span>
            <span className="font-semibold text-sm sm:text-base text-primary truncate block">
              {current.from}
            </span>
          </div>
          <div className="border-l border-ink-800 pl-4">
            <span className="block text-[10px] text-secondary tracking-wider">ETA</span>
            <span className="font-cockpit text-sm sm:text-base font-bold text-primary">
              {current.time} IST
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-cockpit text-xs font-bold tracking-wider ${
              current.statusColor === 'green'
                ? 'bg-green/15 text-green border border-green/30'
                : current.statusColor === 'amber'
                ? 'bg-amber/15 text-amber border border-amber/30'
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {current.status}
          </span>
          <span className="text-[11px] font-cockpit text-secondary/60 hidden lg:inline">
            Next: {next.flight}
          </span>
        </div>
      </div>
    </div>
  );
};
