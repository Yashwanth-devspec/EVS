import React, { useMemo, useState } from 'react';
import { GroupView, MatchGroup, ProposalView, Trip } from '../types';
import { formatINR, formatTime, formatCountdown, formatKm } from '../utils';
import { waitBandLabel } from '../lib/options';
import { Stamp } from '../components/primitives/Stamp';
import { IconCheck, IconClock, IconCopy, IconPhone, IconShare, IconCar, IconLeaf, IconRupee } from './icons';
import { GroupChat } from './GroupChat';

// -----------------------------------------------------------------------------
// Small shared pieces
// -----------------------------------------------------------------------------
export const DemoTag: React.FC = () => <span className="demo-tag">Demo traveller</span>;

export const Person: React.FC<{
  name: string;
  area: string;
  km?: number;
  isYou?: boolean;
  isDemo?: boolean;
  right?: React.ReactNode;
}> = ({ name, area, km, isYou, isDemo, right }) => (
  <div className="flex items-center gap-3 py-2.5">
    <span className={`avatar ${isYou ? 'avatar-you' : ''}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-primary">{isYou ? 'You' : name}</span>
        {isDemo && !isYou && <DemoTag />}
      </div>
      <div className="text-sm text-secondary">
        {area}
        {!isYou && km !== undefined && km > 0 ? ` · about ${formatKm(km, 1)} from your drop` : ''}
      </div>
    </div>
    {right}
  </div>
);

export const CountdownRing: React.FC<{ left: number; total: number }> = ({ left, total }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / Math.max(1, total)));
  return (
    <div className="relative h-16 w-16 shrink-0" role="timer" aria-label={`${formatCountdown(left)} left to reply`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="#1E2426" strokeWidth="5" fill="none" />
        <circle
          cx="32"
          cy="32"
          r={r}
          stroke={frac < 0.25 ? '#FF5C4D' : '#FFB020'}
          strokeWidth="5"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-primary">
        {formatCountdown(left)}
      </span>
    </div>
  );
};

export const SafetyRow: React.FC<{ group: GroupView }> = ({ group }) => {
  const text = [
    'I’m sharing a cab from Bengaluru airport (BLR) with EcoRide Share.',
    `Pickup: ${group.pickup_point}. Pickup code: ${group.pickup_code}.`,
    group.cab_number ? `Cab number: ${group.cab_number}.` : null,
    `Sharing with: ${group.members.filter((m) => !m.is_you).map((m) => m.first_name).join(', ')}.`,
    `Trip status: ${window.location.origin}/t/${group.share_token}`,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <div className="grid grid-cols-2 gap-2">
      <a className="btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        <IconShare /> Share with family
      </a>
      <a className="btn-secondary text-red" href="tel:112">
        <IconPhone /> Call 112
      </a>
    </div>
  );
};

function copy(text: string, onDone: () => void) {
  navigator.clipboard?.writeText(text).then(onDone, onDone);
}

/** Ordered stops. Address lines and Copy buttons appear only for the person booking. */
export const StopsList: React.FC<{ group: GroupView }> = ({ group }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const all = group.stops
    .map((s, i) => `${i + 1}. ${s.first_name}: ${s.address_line ?? s.area}`)
    .join('\n');
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">Stops, in order</h3>
        {group.is_booker && (
          <button type="button" className="btn-quiet" onClick={() => copy(all, () => setCopied('all'))} data-demo="copy-all-stops">
            <IconCopy size={16} /> {copied === 'all' ? 'Copied' : 'Copy all'}
          </button>
        )}
      </div>
      <ol className="mt-3 space-y-3">
        {group.stops.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="stop-num">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-primary">
                {s.is_you ? 'You' : s.first_name} <span className="text-secondary font-normal">· {s.area}</span>
              </div>
              {s.address_line && <div className="text-sm text-secondary break-words">{s.address_line}</div>}
            </div>
            {s.address_line && (
              <button
                type="button"
                className="btn-quiet shrink-0"
                onClick={() => copy(s.address_line!, () => setCopied(String(i)))}
                aria-label={`Copy stop ${i + 1} address`}
              >
                {copied === String(i) ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </button>
            )}
          </li>
        ))}
      </ol>
      {!group.is_booker && (
        <p className="mt-3 text-sm text-secondary">Exact addresses go only to {group.booker_name}, who books the cab.</p>
      )}
    </div>
  );
};

export const Skeleton: React.FC = () => (
  <div className="space-y-3" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <span className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <span className="skeleton block h-3.5 w-2/5 rounded" />
          <span className="skeleton block h-3 w-3/5 rounded" />
        </div>
        <span className="skeleton h-6 w-16 rounded" />
      </div>
    ))}
  </div>
);

// -----------------------------------------------------------------------------
// Searching
// -----------------------------------------------------------------------------
export const SearchingPanel: React.FC<{ trip: Trip | null }> = ({ trip }) => (
  <div className="space-y-4" data-demo="trip-searching">
    <div className="grid grid-cols-2 gap-3">
      <div className="stat-tile">
        <span className="stat-num">{trip?.live.landing_soon ?? '–'}</span>
        <span className="stat-label">landing in the next 90 min</span>
      </div>
      <div className="stat-tile">
        <span className="stat-num text-green">{trip?.request ? trip.live.heading_your_way : '–'}</span>
        <span className="stat-label">heading your way</span>
      </div>
    </div>
    <Skeleton />
  </div>
);

// -----------------------------------------------------------------------------
// Options
// -----------------------------------------------------------------------------
const OptionSummary: React.FC<{ g: MatchGroup; baseDate?: string }> = ({ g, baseDate }) => (
  <div className="text-sm text-secondary">
    Leave {formatTime(g.depart_time, { baseDate })} · {g.viewer_extra_wait_min > 0 ? `wait ${g.viewer_extra_wait_min} min more` : 'no extra wait'} ·{' '}
    {g.members.length} people
  </div>
);

export const OptionsPanel: React.FC<{
  trip: Trip;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChangeTrip: () => void;
}> = ({ trip, selectedId, onSelect, onChangeTrip }) => {
  const opts = trip.options!;
  const [showOthers, setShowOthers] = useState(false);
  const best = opts.groups.find((g) => g.id === opts.best_id) ?? opts.groups[0];
  const selected = opts.groups.find((g) => g.id === selectedId) ?? best;
  const others = opts.groups.filter((g) => g.id !== best.id);
  const bands = useMemo(() => {
    const map = new Map<string, MatchGroup[]>();
    others
      .slice()
      .sort((a, b) => a.viewer_extra_wait_min - b.viewer_extra_wait_min)
      .forEach((g) => {
        const k = waitBandLabel(g.viewer_extra_wait_min);
        map.set(k, [...(map.get(k) ?? []), g]);
      });
    return [...map.entries()];
  }, [others]);
  const baseDate = trip.request?.scheduled_arrival;

  return (
    <div className="space-y-4">
      {trip.notice && <p className="rounded-2xl border border-amber/40 bg-amber/10 p-3 text-sm text-primary">{trip.notice}</p>}

      <button
        type="button"
        onClick={() => onSelect(best.id!)}
        className={`w-full text-left rounded-3xl border-2 p-5 transition-colors ${
          selected.id === best.id ? 'border-amber bg-ink-900' : 'border-ink-800 bg-ink-900/60'
        }`}
        data-demo="best-match"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-amber">Best match</span>
          {opts.needs_longer_wait && <span className="text-xs text-amber">Needs a longer wait</span>}
        </div>
        <div className="mt-2 text-[34px] leading-none font-extrabold text-green tabular-nums">
          Save {formatINR(best.viewer_saving_inr, true).replace('about ', '')}
        </div>
        <div className="mt-1 text-sm text-secondary">
          You pay {formatINR(best.viewer_share_est, true)} instead of {formatINR(best.viewer_solo_est, true)} (est.)
        </div>
        <div className="mt-3">
          <OptionSummary g={best} baseDate={baseDate} />
        </div>
        <div className="mt-3 divide-y divide-ink-800 border-t border-ink-800">
          {best.members
            .filter((m) => !m.is_you)
            .map((m) => (
              <Person key={m.request_id} name={m.first_name} area={m.zone} km={m.approx_km_from_you} isDemo={m.is_demo} />
            ))}
        </div>
      </button>

      {others.length > 0 && (
        <div>
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-left font-semibold text-primary"
            onClick={() => setShowOthers((v) => !v)}
            aria-expanded={showOthers}
            data-demo="other-options"
          >
            <span>See other options ({others.length})</span>
            <span className="text-sm font-normal text-secondary">{showOthers ? 'Hide' : 'Wait longer to save more'}</span>
          </button>
          {showOthers && (
            <div className="space-y-4">
              {bands.map(([band, list]) => (
                <div key={band}>
                  <h4 className="mb-2 text-sm text-secondary">{band}</h4>
                  <div className="space-y-2">
                    {list.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => onSelect(g.id!)}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          selected.id === g.id ? 'border-amber bg-ink-900' : 'border-ink-800 bg-ink-900/60 hover:border-ink-700'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold text-primary">
                            {g.members.filter((m) => !m.is_you).map((m) => m.first_name).join(', ')}
                          </span>
                          <span className="font-bold text-green tabular-nums">Save {formatINR(g.viewer_saving_inr, true).replace('about ', '')}</span>
                        </div>
                        <OptionSummary g={g} baseDate={baseDate} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
        <a className="link" href={opts.solo.uber_link} target="_blank" rel="noreferrer">
          Book alone instead ({formatINR(opts.solo.solo_fare_est, true)})
        </a>
        <button type="button" className="link" onClick={onChangeTrip}>
          Change where or when
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// No match
// -----------------------------------------------------------------------------
export const NoMatchPanel: React.FC<{ trip: Trip; onChangeTrip: () => void }> = ({ trip, onChangeTrip }) => (
  <div className="space-y-4" data-demo="trip-no-match">
    <div className="grid grid-cols-2 gap-3">
      <div className="stat-tile">
        <span className="stat-num">{trip.live.landing_soon}</span>
        <span className="stat-label">landing in the next 90 min</span>
      </div>
      <div className="stat-tile">
        <span className="stat-num">{trip.live.heading_your_way}</span>
        <span className="stat-label">heading your way so far</span>
      </div>
    </div>
    <p className="text-secondary">
      We check again every few seconds. If someone books a trip near yours, they’ll show up here and you can invite them.
    </p>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {trip.options?.solo && (
        <a className="link" href={trip.options.solo.uber_link} target="_blank" rel="noreferrer" data-demo="book-alone">
          Book alone ({formatINR(trip.options.solo.solo_fare_est, true)})
        </a>
      )}
      <button type="button" className="link" onClick={onChangeTrip}>
        Change where or when
      </button>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Invite sent
// -----------------------------------------------------------------------------
const ResponseBadge: React.FC<{ r: 'pending' | 'accepted' | 'declined' }> = ({ r }) =>
  r === 'accepted' ? (
    <span className="badge badge-green">
      <IconCheck size={14} /> Said yes
    </span>
  ) : r === 'declined' ? (
    <span className="badge badge-red">Said no</span>
  ) : (
    <span className="badge badge-amber">
      <span className="pulse-dot" /> Waiting
    </span>
  );

export const InviteSentPanel: React.FC<{ proposal: ProposalView; left: number }> = ({ proposal, left }) => {
  const sortedMembers = useMemo(() => {
    return [...proposal.members].sort((a, b) => (a.is_you ? -1 : b.is_you ? 1 : 0));
  }, [proposal.members]);

  return (
    <div className="space-y-4" data-demo="trip-invite-sent">
      <div className="flex items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <CountdownRing left={left} total={proposal.window_seconds} />
        <div className="text-sm text-secondary">
          Everyone has {Math.round(proposal.window_seconds / 60)} minutes to reply. If someone says no, you go back to your other options.
        </div>
      </div>
      <div className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900 px-4" aria-live="polite">
        {sortedMembers.map((m) => (
          <Person
            key={m.request_id}
            name={m.is_you ? 'You' : m.first_name}
            area={m.area}
            km={m.approx_km_from_you}
            isYou={m.is_you}
            isDemo={m.is_demo}
            right={
              m.is_you ? (
                <span className="badge badge-green">
                  <IconCheck size={14} /> You sent invite
                </span>
              ) : (
                <ResponseBadge r={m.response} />
              )
            }
          />
        ))}
      </div>
      {proposal.saving_inr !== undefined && (
        <p className="text-sm text-secondary">
          If everyone says yes you save {formatINR(proposal.saving_inr, true)} (est.).
        </p>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Confirmed, landed, pickup, cab booked
// -----------------------------------------------------------------------------
export const PickupCode: React.FC<{ code: string; big?: boolean }> = ({ code, big }) => (
  <div className="ticket-card flex items-center justify-between gap-4 p-5" data-demo="pickup-code">
    <div>
      <div className="text-sm text-on-paper/70">Pickup code</div>
      <div className={`font-cockpit font-bold tracking-[0.12em] text-on-paper ${big ? 'text-6xl' : 'text-4xl'}`}>{code}</div>
    </div>
    <div className="text-right text-sm text-on-paper/70 max-w-[11rem]">Everyone in your group has the same code. Check it before you get in.</div>
  </div>
);

export const ConfirmedPanel: React.FC<{ trip: Trip; serverNow: number; onSendMessage?: (text: string) => Promise<unknown> }> = ({ trip, serverNow, onSendMessage }) => {
  const g = trip.group!;
  const req = trip.request!;
  const landAt = new Date(req.scheduled_arrival).getTime() + req.delay_min * 60000;
  const toLanding = Math.round((landAt - serverNow) / 1000);
  return (
    <div className="space-y-4" data-demo="trip-confirmed">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <div>
          <div className="text-sm text-secondary">{toLanding > 0 ? 'You land in' : 'You should have landed'}</div>
          <div className="text-3xl font-bold tabular-nums text-amber">{toLanding > 0 ? formatCountdown(toLanding) : formatTime(new Date(landAt))}</div>
          <div className="text-sm text-secondary">
            Cab leaves about {formatTime(g.depart_time, { baseDate: req.scheduled_arrival })} · {g.cab_name}
          </div>
        </div>
        <Stamp label="Confirmed" />
      </div>
      <div className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900 px-4">
        {g.members.map((m) => (
          <Person
            key={m.request_id}
            name={m.first_name}
            area={m.area}
            km={m.approx_km_from_you}
            isYou={m.is_you}
            isDemo={m.is_demo}
            right={m.is_booker ? <span className="badge">Books the cab</span> : m.phase !== 'waiting' ? <span className="badge badge-green">Landed</span> : null}
          />
        ))}
      </div>
      <StopsList group={g} />
      {onSendMessage && <GroupChat group={g} onSendMessage={onSendMessage} />}
      <SafetyRow group={g} />
    </div>
  );
};

export const LandedPanel: React.FC<{ trip: Trip; onSendMessage?: (text: string) => Promise<unknown> }> = ({ trip, onSendMessage }) => {
  const g = trip.group!;
  return (
    <div className="space-y-4" data-demo="trip-landed">
      <PickupCode code={g.pickup_code} big />
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <div className="text-sm text-secondary">Meet at</div>
        <div className="text-lg font-semibold text-primary">{g.pickup_point}</div>
        <div className="mt-1 text-sm text-secondary">Follow the signs for app cabs after you collect your bags.</div>
      </div>
      <div className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900 px-4">
        {g.members.filter((m) => !m.is_you).map((m) => (
          <Person
            key={m.request_id}
            name={m.first_name}
            area={m.area}
            isDemo={m.is_demo}
            right={<span className={`badge ${m.phase === 'waiting' ? '' : 'badge-green'}`}>{m.phase === 'at_pickup' ? 'At pickup' : m.phase === 'waiting' ? 'Not landed yet' : 'Landed'}</span>}
          />
        ))}
      </div>
      {onSendMessage && <GroupChat group={g} onSendMessage={onSendMessage} />}
      <SafetyRow group={g} />
    </div>
  );
};

export const AtPickupPanel: React.FC<{
  trip: Trip;
  cabInput: string;
  onCabInput: (v: string) => void;
  cabError: string | null;
  onSendMessage?: (text: string) => Promise<unknown>;
}> = ({
  trip,
  cabInput,
  onCabInput,
  cabError,
  onSendMessage,
}) => {
  const g = trip.group!;
  if (!g.is_booker) {
    return (
      <div className="space-y-4" data-demo="trip-at-pickup">
        <PickupCode code={g.pickup_code} />
        <div className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <span className="pulse-dot" />
          <span className="text-primary">{g.booker_name} is booking the cab now.</span>
        </div>
        <StopsList group={g} />
        {onSendMessage && <GroupChat group={g} onSendMessage={onSendMessage} />}
        <SafetyRow group={g} />
      </div>
    );
  }
  return (
    <div className="space-y-4" data-demo="trip-at-pickup">
      <PickupCode code={g.pickup_code} />
      <StopsList group={g} />
      <label className="block rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <span className="font-semibold text-primary">Cab number</span>
        <span className="block text-sm text-secondary">Once you’ve booked, add the number plate so everyone can find the cab.</span>
        <input
          value={cabInput}
          onChange={(e) => onCabInput(e.target.value.toUpperCase().slice(0, 16))}
          placeholder="KA 01 AB 1234"
          className="field mt-3 font-cockpit text-lg uppercase tracking-wider"
          autoComplete="off"
          aria-invalid={!!cabError}
          data-demo="cab-input"
        />
        {cabError && <span className="mt-1.5 block text-sm text-red">{cabError}</span>}
      </label>
      {onSendMessage && <GroupChat group={g} onSendMessage={onSendMessage} />}
    </div>
  );
};

export const NumberPlate: React.FC<{ value: string }> = ({ value }) => (
  <div className="mx-auto w-fit max-w-full rounded-xl border-[3px] border-on-paper bg-paper px-5 py-2.5 shadow-ticket" data-demo="cab-number">
    <span className="whitespace-nowrap font-cockpit text-[26px] font-bold tracking-[0.08em] text-on-paper">{value}</span>
  </div>
);

export const CabBookedPanel: React.FC<{ trip: Trip; onSendMessage?: (text: string) => Promise<unknown> }> = ({ trip, onSendMessage }) => {
  const g = trip.group!;
  return (
    <div className="space-y-4" data-demo="trip-cab-booked">
      <div className="rounded-3xl border border-ink-800 bg-ink-900 p-5 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-secondary">
          <IconCar /> {g.cab_name}
        </div>
        <NumberPlate value={g.cab_number!} />
        <div className="text-sm text-secondary">Pickup code {g.pickup_code} · booked by {g.is_booker ? 'you' : g.booker_name}</div>
      </div>
      <StopsList group={g} />
      {onSendMessage && <GroupChat group={g} onSendMessage={onSendMessage} />}
      <SafetyRow group={g} />
    </div>
  );
};

// -----------------------------------------------------------------------------
// Settle up and done
// -----------------------------------------------------------------------------
export const SettlePanel: React.FC<{
  trip: Trip;
  fare: string;
  onFare: (v: string) => void;
  upi: string;
  onUpi: (v: string) => void;
  error: string | null;
}> = ({ trip, fare, onFare, upi, onUpi, error }) => {
  const g = trip.group!;
  const me = g.members.find((m) => m.is_you) ?? g.members[0];

  if (g.is_booker && !g.final_fare) {
    return (
      <div className="space-y-4" data-demo="trip-settle">
        <label className="block rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <span className="font-semibold text-primary">Final fare</span>
          <span className="block text-sm text-secondary">What the cab app charged, including tolls. Our estimate was {formatINR(g.fare_total_est, true)}.</span>
          <div className="relative mt-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary">Rs</span>
            <input
              value={fare}
              onChange={(e) => onFare(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
              inputMode="numeric"
              className="field pl-11 text-2xl font-bold tabular-nums"
              aria-label="Final fare in rupees"
              data-demo="fare-input"
            />
          </div>
        </label>
        <label className="block rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <span className="font-semibold text-primary">
            Your UPI ID <span className="font-normal text-secondary">(optional)</span>
          </span>
          <span className="block text-sm text-secondary">So the others can pay you with one tap. Shown only to your group.</span>
          <input value={upi} onChange={(e) => onUpi(e.target.value.trim().slice(0, 64))} placeholder="name@bank" className="field mt-3" autoComplete="off" data-demo="upi-input" />
        </label>
        {error && <p className="text-sm text-red">{error}</p>}
        <p className="text-sm text-secondary">
          The split uses the same method as the estimate: airport fees by seat, the rest by how far each person rides.
        </p>
      </div>
    );
  }

  if (g.is_booker) {
    return (
      <div className="space-y-4" data-demo="trip-settle">
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-secondary">Final fare</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{formatINR(g.final_fare!)}</span>
          </div>
          <div className="mt-3 divide-y divide-ink-800">
            {g.members.map((m) => (
              <div key={m.request_id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-primary">
                  {m.is_you ? 'You' : m.first_name} {m.is_demo && !m.is_you && <DemoTag />}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums text-primary">{formatINR(m.final_share ?? 0)}</span>
                  {!m.is_you && (m.phase === 'paid' || m.phase === 'done') && <span className="badge badge-green">Paid</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
        {!g.booker_upi && <p className="text-sm text-secondary">Collect by UPI or cash. Add your UPI ID next time for one-tap links.</p>}
      </div>
    );
  }

  if (!g.final_fare) {
    return (
      <div className="space-y-4" data-demo="trip-settle">
        <div className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <span className="pulse-dot" />
          <span className="text-primary">Waiting for {g.booker_name} to enter the fare.</span>
        </div>
        <p className="text-sm text-secondary">Your estimated share was {formatINR(me.fare_share_est, true)}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-demo="trip-settle">
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-5 text-center">
        <div className="text-secondary">Pay {g.booker_name}</div>
        <div className="text-5xl font-extrabold tabular-nums text-primary">{formatINR(me.final_share ?? 0)}</div>
        <div className="mt-1 text-sm text-secondary">Your share of {formatINR(g.final_fare)} (estimate was {formatINR(me.fare_share_est, true)})</div>
      </div>
      {g.pay_link ? (
        <a className="btn-secondary w-full" href={g.pay_link} data-demo="pay-upi">
          <IconRupee /> Pay by UPI
        </a>
      ) : (
        <p className="text-sm text-secondary">{g.booker_name} didn’t add a UPI ID. Pay by UPI or cash in person.</p>
      )}
    </div>
  );
};

export const DonePanel: React.FC<{ trip: Trip; totalCo2?: number }> = ({ trip, totalCo2 }) => {
  const g = trip.group!;
  const me = g.members.find((m) => m.is_you) ?? g.members[0];
  const paid = me?.final_share ?? me?.fare_share_est ?? 0;
  const saved = Math.max(0, (me?.solo_fare_est ?? 0) - paid);
  const co2 = g.co2_saved_kg;
  return (
    <div className="space-y-4" data-demo="trip-done">
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-tile">
          <span className="flex items-center gap-1.5 text-green"><IconRupee size={16} /> You saved</span>
          <span className="stat-num text-green">{formatINR(saved, true).replace('about ', '')}</span>
          <span className="stat-label">vs about {formatINR(me.solo_fare_est, true).replace('about ', '')} alone (est.)</span>
        </div>
        <div className="stat-tile">
          <span className="flex items-center gap-1.5 text-green"><IconLeaf size={16} /> CO2 avoided</span>
          <span className="stat-num text-green">{co2.toFixed(1)} kg</span>
          <span className="stat-label">by your group, est.</span>
        </div>
      </div>
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4 text-sm text-secondary">
        <div className="flex items-center justify-between">
          <span>EcoRide total so far</span>
          <span className="demo-chip">Demo data</span>
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-primary" data-demo="impact-total">
          {totalCo2 !== undefined ? `${totalCo2.toFixed(1)} kg CO2 avoided` : '…'}
        </div>
        <div>{g.km_saved.toFixed(1)} km of airport road your group didn’t drive.</div>
      </div>
      <p className="flex items-center gap-2 text-sm text-secondary">
        <IconClock size={16} /> Your addresses for this trip are already deleted. Everything else goes in 24 hours.
      </p>
    </div>
  );
};
