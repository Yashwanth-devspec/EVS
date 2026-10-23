import React, { useMemo, useState } from 'react';
import { PublicConfig } from '../../types';
import { fareExample, DETOUR_KM_PER_EXTRA_STOP } from '../../lib/fare';
import { formatINR } from '../../utils';
import { DigitRoll } from './DigitRoll';

/**
 * The saving, worked out in the open with the same fare model the matching engine uses (from /config).
 */
export const FareSplitCalculator: React.FC<{ config: PublicConfig | null; className?: string }> = ({ config, className = '' }) => {
  const [riders, setRiders] = useState(3);
  const [areaKey, setAreaKey] = useState('Jayanagar');
  const ex = useMemo(() => (config ? fareExample(config, areaKey, riders) : null), [config, areaKey, riders]);
  if (!config || !ex) return <div className={`h-[420px] rounded-3xl border border-ink-800 bg-ink-900 ${className}`} />;

  const fm = config.fare_model;
  const fixedEach = ex.fixedFees / riders;
  const distTotal = ex.sharedTotal - ex.fixedFees;
  const distEach = distTotal / riders;

  return (
    <div className={`grid grid-cols-1 gap-6 rounded-3xl border border-ink-800 bg-ink-900 p-5 sm:p-8 lg:grid-cols-12 ${className}`}>
      <div className="space-y-6 lg:col-span-5">
        <label className="block">
          <span className="text-secondary">Going to</span>
          <select value={areaKey} onChange={(e) => setAreaKey(e.target.value)} className="field mt-2 text-lg font-semibold">
            {Object.entries(config.zones).map(([k, z]) => (
              <option key={k} value={k}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-secondary">People sharing</span>
            <span className="text-xl font-bold text-primary tabular-nums">{riders === 1 ? 'Just you' : `${riders} people`}</span>
          </div>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={riders}
            onChange={(e) => setRiders(Number(e.target.value))}
            aria-label="Number of people sharing"
            className="mt-3 w-full accent-amber"
          />
          <div className="mt-1 flex justify-between text-sm text-secondary tabular-nums">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
        </div>
        <div className="rounded-2xl bg-ink-950 p-5">
          <div className="text-secondary">Each person pays</div>
          <div className="mt-1 text-5xl font-extrabold tracking-tight text-primary">
            <DigitRoll value={Math.round(ex.perPerson / 10) * 10} prefix="Rs " />
          </div>
          {riders > 1 ? (
            <div className="mt-2 font-semibold text-green">
              {formatINR(ex.saving, true)} less than going alone ({ex.savingPct}%) est.
            </div>
          ) : (
            <div className="mt-2 text-secondary">Going alone. Slide to add people.</div>
          )}
        </div>
      </div>

      <div className="lg:col-span-7">
        <h3 className="text-lg font-semibold text-primary">The worked example</h3>
        <dl className="mt-4 divide-y divide-ink-800 text-[15px]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-secondary">Road distance, airport to {ex.area}</dt>
            <dd className="tabular-nums text-primary">about {Math.round(ex.soloKm)} km</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-secondary">Alone: Rs {fm.base} base + Rs {fm.per_km}/km + Rs {fm.airport_access_fee} airport + Rs {fm.toll_fee} toll</dt>
            <dd className="tabular-nums text-primary">{formatINR(ex.soloFare, true)}</dd>
          </div>
          {riders > 1 && (
            <>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-secondary">
                  Shared route: {Math.round(ex.soloKm)} km + {DETOUR_KM_PER_EXTRA_STOP} km for each extra stop
                </dt>
                <dd className="tabular-nums text-primary">{Math.round(ex.sharedKm)} km</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-secondary">Fixed fees (Rs {Math.round(ex.fixedFees)}) split by seat</dt>
                <dd className="tabular-nums text-primary">{formatINR(fixedEach, true)} each</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-secondary">Distance part ({formatINR(distTotal, true)}) split by how far each person rides</dt>
                <dd className="tabular-nums text-primary">{formatINR(distEach, true)} each</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-4 py-3 font-semibold">
            <dt className="text-primary">You pay</dt>
            <dd className="tabular-nums text-green">{formatINR(ex.perPerson, true)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-secondary">
          Everyone in this example goes to the same area, so the distance part splits evenly. When drops differ, the person
          riding further pays more. {fm.disclaimer}
        </p>
      </div>
    </div>
  );
};
