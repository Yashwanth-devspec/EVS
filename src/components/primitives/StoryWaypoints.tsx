import React, { useState } from 'react';

interface TravelerProfile {
  id: string;
  name: string;
  role: string;
  flight: string;
  from: string;
  terminal: string;
  bags: string;
  area: string;
  landmark: string;
  soloFare: number;
  sharedFare: number;
  saving: number;
}

const TRAVELERS: TravelerProfile[] = [
  {
    id: 'meera',
    name: 'Meera',
    role: 'Product lead',
    flight: '6E 2134',
    from: 'Delhi (DEL)',
    terminal: 'T1',
    bags: '1 cabin trolley',
    area: 'Indiranagar',
    landmark: '100ft Road near Metro',
    soloFare: 1540,
    sharedFare: 520,
    saving: 1020,
  },
  {
    id: 'arjun',
    name: 'Arjun',
    role: 'Backend engineer',
    flight: 'AI 506',
    from: 'Mumbai (BOM)',
    terminal: 'T2',
    bags: '1 laptop backpack',
    area: 'Koramangala',
    landmark: 'Sony World Signal, 4th Block',
    soloFare: 1610,
    sharedFare: 560,
    saving: 1050,
  },
  {
    id: 'priya',
    name: 'Priya',
    role: 'Research consultant',
    flight: 'UK 812',
    from: 'Kolkata (CCU)',
    terminal: 'T2',
    bags: '1 medium suitcase',
    area: 'HSR Layout',
    landmark: '27th Main Road, Sector 1',
    soloFare: 1680,
    sharedFare: 590,
    saving: 1090,
  },
];

export const StoryWaypoints: React.FC = () => {
  const [selectedId, setSelectedId] = useState('meera');
  const active = TRAVELERS.find((t) => t.id === selectedId) || TRAVELERS[0];

  return (
    <div className="w-full rounded-3xl border border-ink-800 bg-ink-950 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-800 pb-4">
        <div>
          <span className="font-cockpit text-xs font-semibold text-amber tracking-wider">Real Bangalore co-travellers</span>
          <h3 className="mt-1 text-2xl font-bold text-primary">Who you actually share with</h3>
        </div>
        <span className="font-cockpit text-xs text-secondary self-start sm:self-auto">
          3 travellers landing 23:45 - 23:55 IST
        </span>
      </div>

      {/* Traveler Selector Pills */}
      <div className="flex flex-wrap gap-2.5">
        {TRAVELERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedId(t.id)}
            className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selectedId === t.id
                ? 'border border-amber bg-amber/15 text-primary shadow-sm'
                : 'border border-ink-800 bg-ink-900 text-secondary hover:border-ink-700 hover:text-primary'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                selectedId === t.id ? 'bg-amber text-ink-950' : 'bg-ink-800 text-secondary'
              }`}
            >
              {t.name[0]}
            </span>
            <span>{t.name}</span>
            <span className="text-xs font-cockpit text-secondary/80">({t.area})</span>
          </button>
        ))}
      </div>

      {/* Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 rounded-2xl border border-ink-800 bg-ink-900/50 p-5 sm:p-6 items-center">
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-cockpit text-base font-bold text-primary">{active.name}</span>
            <span className="text-xs text-secondary">· {active.role}</span>
            <span className="rounded bg-ink-800 px-2 py-0.5 font-cockpit text-xs text-amber border border-ink-700">
              {active.terminal}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm pt-1">
            <div>
              <span className="block text-xs text-secondary">Flight</span>
              <span className="font-cockpit font-semibold text-primary">{active.flight} from {active.from}</span>
            </div>
            <div>
              <span className="block text-xs text-secondary">Luggage</span>
              <span className="font-semibold text-primary">{active.bags}</span>
            </div>
            <div>
              <span className="block text-xs text-secondary">Destination</span>
              <span className="font-semibold text-primary">{active.area}</span>
            </div>
            <div>
              <span className="block text-xs text-secondary">Drop point</span>
              <span className="font-semibold text-primary truncate block">{active.landmark}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 rounded-2xl border border-ink-800 bg-ink-950 p-4 space-y-3">
          <div className="flex items-baseline justify-between text-xs text-secondary">
            <span>Solo estimate</span>
            <span className="line-through font-cockpit">Rs {active.soloFare}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-primary">Shared share</span>
            <span className="font-cockpit text-2xl font-bold text-green">Rs {active.sharedFare}</span>
          </div>
          <div className="rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-xs font-medium text-green flex items-center justify-between">
            <span>Money saved</span>
            <span className="font-cockpit font-bold text-sm">Rs {active.saving}</span>
          </div>
        </div>
      </div>

      {/* Real Bangalore Route Waypoint Spine */}
      <div className="pt-2 space-y-3">
        <span className="font-cockpit text-xs text-secondary block">The 44 km route together down Bellary Road</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-cockpit">
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 text-center">
            <span className="text-amber block font-bold">BLR T1/T2</span>
            <span className="text-secondary text-[11px]">0 km · Pickup</span>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 text-center">
            <span className="text-primary block font-bold">Trumpet Flyover</span>
            <span className="text-secondary text-[11px]">12 km · Toll split</span>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 text-center">
            <span className="text-primary block font-bold">Hebbal Flyover</span>
            <span className="text-secondary text-[11px]">28 km · 1 cab</span>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 text-center">
            <span className="text-green block font-bold">Mekhri Circle</span>
            <span className="text-secondary text-[11px]">34 km · ORR split</span>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 text-center col-span-2 sm:col-span-1">
            <span className="text-green block font-bold">Your Drop</span>
            <span className="text-secondary text-[11px]">Whole rupee UPI</span>
          </div>
        </div>
      </div>
    </div>
  );
};
