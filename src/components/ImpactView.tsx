import React from 'react';
import { ImpactMetrics } from '../types';
import { DigitRoll } from './primitives/DigitRoll';
import { Num } from './primitives/Num';

export const ImpactView: React.FC<{
  impact: ImpactMetrics | null;
  onGoToMethodology: () => void;
}> = ({ impact, onGoToMethodology }) => {
  const waves = impact?.wave_breakdown ?? [
    { wave: '11:00 – 11:15 pm', cabs_avoided: 3, km_saved: 84.2, co2_kg: 14.3 },
    { wave: '11:15 – 11:30 pm', cabs_avoided: 5, km_saved: 142.0, co2_kg: 24.1 },
    { wave: '11:30 – 11:45 pm', cabs_avoided: 4, km_saved: 110.5, co2_kg: 18.8 },
    { wave: '11:45 – 12:00 am', cabs_avoided: 2, km_saved: 56.4, co2_kg: 9.6 },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-ink-800 pb-6">
        <div>
          <span className="text-sm font-semibold text-green block">
            Bengaluru airport road
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-primary mt-1 font-sans">
            What difference sharing makes
          </h1>
        </div>
        <span className="px-3.5 py-1.5 rounded-full bg-ink-900 border border-ink-700 text-sm font-semibold text-amber self-start sm:self-auto">
          Demo data
        </span>
      </div>

      {/* Hero Impact Stats */}
      <div className="space-y-8">
        <div>
          <span className="text-sm font-semibold text-secondary block">
            Estimated carbon emissions prevented
          </span>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-7xl sm:text-9xl font-extrabold text-green tracking-tight leading-none font-sans">
              <DigitRoll value={impact?.co2_saved_kg ?? 66.8} />
            </span>
            <span className="text-2xl sm:text-3xl text-green font-bold font-sans">kg CO2</span>
          </div>
        </div>

        {/* 3 Supporting numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 pt-6 border-t border-ink-800">
          <div>
            <span className="text-sm font-semibold text-secondary block">
              Expressway distance saved
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-5xl font-bold text-primary font-sans">
                <DigitRoll value={impact?.km_saved ?? 393.1} />
              </span>
              <span className="text-base text-secondary font-medium">km</span>
            </div>
            <p className="text-sm text-secondary mt-1">Sum of avoided solo runs between BLR and city drops</p>
          </div>

          <div>
            <span className="text-sm font-semibold text-secondary block">
              Solo airport cabs avoided
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-5xl font-bold text-primary font-sans">
                <DigitRoll value={impact?.cabs_avoided ?? 14} />
              </span>
              <span className="text-base text-secondary font-medium">cabs</span>
            </div>
            <p className="text-sm text-secondary mt-1">Dead mileage trips avoided on Bellary Road</p>
          </div>

          <div>
            <span className="text-sm font-semibold text-secondary block">
              Average passenger saving
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-5xl font-bold text-green font-sans">
                <DigitRoll value={impact?.avg_saving_pct ?? 28.5} suffix="%" />
              </span>
            </div>
            <p className="text-sm text-secondary mt-1">Compared to individual solo cab fares</p>
          </div>
        </div>
      </div>

      {/* Paired Columns Chart */}
      <div className="rounded-3xl bg-ink-900 border border-ink-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-primary font-sans">
              Cab demand by 15-minute flight arrival waves
            </h3>
            <p className="text-sm text-secondary mt-0.5">
              Comparison between separate solo dispatches vs pooled EcoRide cabs
            </p>
          </div>

          <div className="flex items-center gap-5 text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded border-2 border-secondary bg-transparent" />
              <span className="text-secondary">Without sharing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-green" />
              <span className="text-green font-bold">With EcoRide</span>
            </div>
          </div>
        </div>

        {/* SVG paired bar chart */}
        <div className="w-full">
          <svg viewBox="0 0 700 210" className="w-full h-52 select-none text-sm font-sans">
            {/* Grid horizontal guidelines */}
            <line x1="50" y1="30" x2="680" y2="30" stroke="#1E2426" strokeDasharray="3 3" />
            <line x1="50" y1="80" x2="680" y2="80" stroke="#1E2426" strokeDasharray="3 3" />
            <line x1="50" y1="130" x2="680" y2="130" stroke="#1E2426" strokeDasharray="3 3" />
            <line x1="50" y1="170" x2="680" y2="170" stroke="#1E2426" />

            {/* Y axis numbers (min 14px) */}
            <text x="35" y="35" fill="#A7B0AB" textAnchor="end" fontSize="14" fontWeight="500">12</text>
            <text x="35" y="85" fill="#A7B0AB" textAnchor="end" fontSize="14" fontWeight="500">8</text>
            <text x="35" y="135" fill="#A7B0AB" textAnchor="end" fontSize="14" fontWeight="500">4</text>
            <text x="35" y="175" fill="#A7B0AB" textAnchor="end" fontSize="14" fontWeight="500">0</text>

            {/* Waves Paired Bars */}
            {waves.map((w, idx) => {
              const xBase = 100 + idx * 145;
              const soloCount = w.cabs_avoided * 2;
              const sharedCount = w.cabs_avoided;

              const hSolo = (soloCount / 12) * 140;
              const hShared = (sharedCount / 12) * 140;

              return (
                <g key={idx}>
                  {/* Hollow Bar: Without sharing */}
                  <rect
                    x={xBase}
                    y={170 - hSolo}
                    width="28"
                    height={hSolo}
                    fill="transparent"
                    stroke="#A7B0AB"
                    strokeWidth="2.5"
                    rx="4"
                  />
                  {/* Filled Green Bar: With sharing */}
                  <rect
                    x={xBase + 34}
                    y={170 - hShared}
                    width="28"
                    height={hShared}
                    fill="#3DDC97"
                    rx="4"
                  />

                  {/* Wave label below */}
                  <text
                    x={xBase + 31}
                    y="196"
                    fill="#ECEFEA"
                    fontSize="14"
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {w.wave.split('–')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Equivalence & Methodology Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-ink-950 border border-ink-800 text-sm text-secondary">
        <div>
          <span className="text-primary font-bold block text-base">
            Annual tree absorption equivalent: about {((impact?.co2_saved_kg ?? 66.8) / 21).toFixed(1)} mature urban trees
          </span>
          <span className="block mt-0.5">
            Formula calibrated to petrol/diesel fleet emission baseline of 0.17 kg CO2/km
          </span>
        </div>

        <button
          onClick={onGoToMethodology}
          className="text-amber hover:underline font-bold self-start sm:self-auto shrink-0 text-base"
        >
          View Calculation Methodology &rarr;
        </button>
      </div>
    </div>
  );
};
