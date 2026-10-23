import React, { useMemo, useState } from 'react';
import { CreateTripBody } from '../api';
import { GeoResult, PublicConfig } from '../types';
import { formatTime, formatMinutes, nextQuarterHour } from '../utils';
import { AddressSearch } from './AddressSearch';
import { IconChevron } from './icons';

export interface StartPrefill {
  scheduledArrival?: string;
  terminal?: 'T1' | 'T2';
  flightNo?: string | null;
}

export interface StartFormState {
  place: GeoResult | null;
  setPlace: (p: GeoResult | null) => void;
  dropDetail: string;
  setDropDetail: (v: string) => void;
  landing: Date;
  setLanding: (d: Date) => void;
  flightNo: string;
  setFlightNo: (v: string) => void;
  partySize: number;
  setPartySize: (n: number) => void;
  bags: number;
  setBags: (n: number) => void;
  extraTime: boolean;
  setExtraTime: (v: boolean) => void;
  maxWait: number;
  setMaxWait: (n: number) => void;
  womenOnly: boolean;
  setWomenOnly: (v: boolean) => void;
  adult: boolean;
  setAdult: (v: boolean) => void;
  terminal: 'T1' | 'T2';
  setTerminal: (t: 'T1' | 'T2') => void;
  international: boolean;
  setInternational: (v: boolean) => void;
  canSubmit: boolean;
  blocker: string | null;
  toBody: () => CreateTripBody;
}

export function useStartForm(prefill?: StartPrefill): StartFormState {
  const [place, setPlace] = useState<GeoResult | null>(null);
  const [dropDetail, setDropDetail] = useState('');
  const [landing, setLanding] = useState<Date>(() =>
    prefill?.scheduledArrival ? new Date(prefill.scheduledArrival) : nextQuarterHour()
  );
  const [flightNo, setFlightNo] = useState(prefill?.flightNo ?? '');
  const [partySize, setPartySize] = useState(1);
  const [bags, setBags] = useState(0);
  const [extraTime, setExtraTime] = useState(false);
  const [maxWait, setMaxWait] = useState(30);
  const [womenOnly, setWomenOnly] = useState(false);
  const [adult, setAdult] = useState(true);
  const [terminal, setTerminal] = useState<'T1' | 'T2'>(prefill?.terminal ?? 'T1');
  const [international, setInternational] = useState(false);

  let blocker: string | null = null;
  if (!place) blocker = 'Choose where you’re going first.';
  else if (!place.in_range) blocker = 'That drop point is too far for a shared cab.';
  else if (!adult) blocker = 'Confirm you’re 18 or older, or travelling with an adult (More details).';

  return {
    place, setPlace, dropDetail, setDropDetail, landing, setLanding, flightNo, setFlightNo,
    partySize, setPartySize, bags, setBags, extraTime, setExtraTime, maxWait, setMaxWait,
    womenOnly, setWomenOnly, adult, setAdult, terminal, setTerminal, international, setInternational,
    canSubmit: blocker === null,
    blocker,
    toBody: () => ({
      dest_lat: place!.lat,
      dest_lng: place!.lng,
      dest_label: place!.name,
      area: place!.area,
      accuracy: place!.accuracy,
      exact_address: place!.accuracy === 'area' ? null : place!.exact_address ?? `${place!.name}, ${place!.secondary}`,
      drop_detail: dropDetail.trim() || null,
      scheduled_arrival: landing.toISOString(),
      flight_no: flightNo.trim() || null,
      flight_kind: international ? 'international' : 'domestic',
      terminal,
      delay_min: extraTime ? 10 : 0,
      party_size: partySize,
      checked_bags: bags,
      max_wait_min: maxWait,
      women_only: womenOnly,
      adult_confirmed: adult,
    }),
  };
}

function landingChips(now: Date): { label: string; at: Date }[] {
  const first = nextQuarterHour(now);
  const chips = [{ label: 'Just landed', at: new Date(Math.floor(now.getTime() / 300000) * 300000) }];
  for (let i = 0; i < 3; i++) {
    const at = new Date(first.getTime() + i * 15 * 60000);
    chips.push({ label: formatTime(at, { baseDate: now }), at });
  }
  // Advance landing horizons for travellers boarding 2, 3 or 5 hours away
  const in2h = nextQuarterHour(new Date(now.getTime() + 2 * 3600000));
  const in3h = nextQuarterHour(new Date(now.getTime() + 3 * 3600000));
  const in5h = nextQuarterHour(new Date(now.getTime() + 5 * 3600000));
  chips.push({ label: 'In 2 hrs', at: in2h });
  chips.push({ label: 'In 3 hrs', at: in3h });
  chips.push({ label: 'In 5 hrs', at: in5h });
  return chips;
}

const Stepper: React.FC<{ label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: (n: number) => string }> = ({
  label, value, min, max, onChange, unit,
}) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-primary">{label}</span>
    <div className="flex items-center gap-1">
      <button type="button" className="step-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
        −
      </button>
      <span className="w-20 text-center tabular-nums font-semibold" aria-live="polite">
        {unit(value)}
      </span>
      <button type="button" className="step-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
        +
      </button>
    </div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; demo?: string }> = ({
  checked, onChange, label, hint, demo,
}) => (
  <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
    <span>
      <span className="block text-primary">{label}</span>
      {hint && <span className="block text-sm text-secondary">{hint}</span>}
    </span>
    <input type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} data-demo={demo} />
  </label>
);

export const StartForm: React.FC<{ form: StartFormState; config: PublicConfig | null; serverNow: number; prefilled?: boolean }> = ({
  form, config, serverNow, prefilled,
}) => {
  const [more, setMore] = useState(false);
  const now = useMemo(() => new Date(serverNow), [Math.floor(serverNow / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const chips = useMemo(() => landingChips(now), [now]);
  const minsAway = Math.round((form.landing.getTime() - now.getTime()) / 60000);

  return (
    <div className="space-y-7">
      <section className="space-y-3" aria-labelledby="q-where">
        <h2 id="q-where" className="text-xl font-bold text-primary">
          Where are you going?
        </h2>
        <AddressSearch
          config={config}
          value={form.place}
          onChange={form.setPlace}
          dropDetail={form.dropDetail}
          onDropDetail={form.setDropDetail}
        />
      </section>

      <section className="space-y-3" aria-labelledby="q-when">
        <h2 id="q-when" className="text-xl font-bold text-primary">
          When do you land?
        </h2>
        {prefilled && <p className="text-sm text-green">Filled in from your invite link. Change it if your flight is different.</p>}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Landing time">
          {chips.map((c, i) => {
            const on = Math.abs(c.at.getTime() - form.landing.getTime()) < 60000;
            return (
              <button
                key={c.label}
                type="button"
                role="radio"
                aria-checked={on}
                className={`chip ${on ? 'chip-on' : ''}`}
                onClick={() => form.setLanding(c.at)}
                data-demo={`land-chip-${i}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-2">
          <button type="button" className="step-btn" onClick={() => form.setLanding(new Date(form.landing.getTime() - 15 * 60000))} aria-label="15 minutes earlier">
            −
          </button>
          <div className="flex-1 text-center" aria-live="polite">
            <div className="text-2xl font-bold tabular-nums text-primary">{formatTime(form.landing, { baseDate: now })}</div>
            <div className="text-sm text-secondary">
              {minsAway > 0 ? `in ${formatMinutes(minsAway)}` : minsAway === 0 ? 'now' : `${formatMinutes(-minsAway)} ago`}
            </div>
          </div>
          <button type="button" className="step-btn" onClick={() => form.setLanding(new Date(form.landing.getTime() + 15 * 60000))} aria-label="15 minutes later">
            +
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-secondary">
          <span>Quick jump:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-lg border border-ink-800 bg-ink-900 px-2.5 py-1 text-secondary hover:text-primary hover:border-ink-700 transition-colors"
              onClick={() => form.setLanding(new Date(form.landing.getTime() + 60 * 60000))}
            >
              +1 hr
            </button>
            <button
              type="button"
              className="rounded-lg border border-ink-800 bg-ink-900 px-2.5 py-1 text-secondary hover:text-primary hover:border-ink-700 transition-colors"
              onClick={() => form.setLanding(new Date(form.landing.getTime() + 180 * 60000))}
            >
              +3 hrs
            </button>
            <button
              type="button"
              className="rounded-lg border border-ink-800 bg-ink-900 px-2.5 py-1 text-secondary hover:text-primary hover:border-ink-700 transition-colors"
              onClick={() => form.setLanding(new Date(Math.floor(now.getTime() / 300000) * 300000))}
            >
              Reset now
            </button>
          </div>
        </div>

        {minsAway >= 90 && (
          <div className="rounded-2xl border border-ink-750 bg-ink-900/80 p-3.5 text-xs text-secondary leading-relaxed">
            <span className="font-semibold text-primary block mb-0.5">Pre-registering for advance landing</span>
            You are scheduling ahead for {formatTime(form.landing, { baseDate: now })} ({minsAway >= 120 ? `about ${Math.round(minsAway / 60)} hours away` : `${minsAway} minutes away`}). You’ll be grouped with travellers landing around the same wave at Bengaluru airport.
          </div>
        )}
        <label className="block">
          <span className="text-sm text-secondary">Flight number (optional)</span>
          <input
            value={form.flightNo}
            onChange={(e) => form.setFlightNo(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="6E 2134"
            className="field mt-1.5 font-cockpit uppercase"
            autoComplete="off"
          />
        </label>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3.5 text-left"
          aria-expanded={more}
          data-demo="more-details"
        >
          <span>
            <span className="block font-semibold text-primary">More details</span>
            <span className="block text-sm text-secondary">
              {form.partySize} {form.partySize === 1 ? 'person' : 'people'}, {form.bags} checked {form.bags === 1 ? 'bag' : 'bags'}, wait up to {form.maxWait} min
            </span>
          </span>
          <IconChevron up={more} />
        </button>
        {more && (
          <div className="mt-2 rounded-2xl border border-ink-800 bg-ink-900 px-4 py-2 divide-y divide-ink-800">
            <Stepper label="People" value={form.partySize} min={1} max={3} onChange={form.setPartySize} unit={(n) => `${n}`} />
            <Stepper label="Checked bags" value={form.bags} min={0} max={3} onChange={form.setBags} unit={(n) => `${n}`} />
            <div className="py-2">
              <span className="block text-primary">Longest you'd wait for others</span>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Longest wait">
                {[15, 30, 60].map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={form.maxWait === m} className={`chip justify-center ${form.maxWait === m ? 'chip-on' : ''}`} onClick={() => form.setMaxWait(m)}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
            <Toggle checked={form.extraTime} onChange={form.setExtraTime} label="I need 10 extra minutes" hint="For luggage, children or getting around" />
            <Toggle checked={form.international} onChange={form.setInternational} label="International flight" hint="Immigration adds time before you can walk out" />
            <div className="py-2">
              <span className="block text-primary">Terminal</span>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Terminal">
                {(['T1', 'T2'] as const).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={form.terminal === t} className={`chip justify-center ${form.terminal === t ? 'chip-on' : ''}`} onClick={() => form.setTerminal(t)}>
                    Terminal {t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              checked={form.womenOnly}
              onChange={form.setWomenOnly}
              label="Women only"
              hint="Self-declared. We can't verify it, so check the pickup code before you get in."
            />
            <Toggle checked={form.adult} onChange={form.setAdult} label="I'm 18 or older, or travelling with an adult" demo="adult" />
          </div>
        )}
      </section>
    </div>
  );
};
