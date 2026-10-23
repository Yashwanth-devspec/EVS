import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api';
import { PublicConfig, Trip, ProposalView, ImpactMetrics } from '../types';
import { formatINR, prefersReducedMotion } from '../utils';
import { useTrip, useServerNow, DisplayState, TripController } from './useTrip';
import { BottomSheet, Snap } from './BottomSheet';
import { TripMap, MapScene } from './TripMap';
import { StartForm, useStartForm, StartPrefill } from './StartForm';
import { copyFor } from './copy';
import { AIRPORT } from './places';
import {
  SearchingPanel, OptionsPanel, NoMatchPanel, InviteSentPanel, ConfirmedPanel, LandedPanel,
  AtPickupPanel, CabBookedPanel, SettlePanel, DonePanel, Person, CountdownRing,
} from './TripPanels';
import { IconCopy } from './icons';
import { Portal } from './Portal';

const DEFAULT_SNAP: Record<DisplayState, Snap> = {
  start: 'full',
  searching: 'peek',
  options: 'half',
  no_match: 'half',
  invite_sent: 'half',
  invite_received: 'half',
  confirmed: 'half',
  landed: 'half',
  at_pickup: 'full',
  cab_booked: 'half',
  settle: 'full',
  done: 'half',
};

const TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

function useIsDesktop(): boolean {
  const q = '(min-width: 768px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

// -----------------------------------------------------------------------------
// Map scene for each state
// -----------------------------------------------------------------------------
function sceneFor(trip: Trip | null, state: DisplayState, formPlace: { lat: number; lng: number; name: string } | null, selectedId: string | null): MapScene {
  const airport = { ...AIRPORT, label: 'BLR' };
  const req = trip?.request;
  const dest = req ? { lat: req.dest_lat, lng: req.dest_lng, label: 'You' } : formPlace ? { lat: formPlace.lat, lng: formPlace.lng, label: formPlace.name } : null;

  if (state === 'start') return { airport, destination: dest, route: dest ? 'preview' : null, focus: dest ? 'route' : 'airport' };

  if (state === 'searching' || state === 'no_match') {
    const seen = new Set<string>();
    const others =
      trip?.options?.groups
        .flatMap((g) => g.members.filter((m) => !m.is_you))
        .filter((m) => (seen.has(m.request_id) ? false : (seen.add(m.request_id), true)))
        .map((m) => ({ lat: m.dest_lat, lng: m.dest_lng })) ?? [];
    return { airport, destination: dest, others: state === 'searching' ? others : [], radar: true, route: 'preview', focus: 'route' };
  }

  const underlying = state === 'invite_received' ? trip?.underlying_state : state;

  if (underlying === 'options' && trip?.options) {
    const g = trip.options.groups.find((x) => x.id === (selectedId ?? trip.options!.best_id)) ?? trip.options.groups[0];
    const stops = [...g.members]
      .sort((a, b) => a.drop_index - b.drop_index)
      .map((m) => ({ lat: m.dest_lat, lng: m.dest_lng, label: m.is_you ? 'You' : m.first_name, isYou: m.is_you }));
    return { airport, stops, route: 'preview', focus: 'route' };
  }

  if (underlying === 'invite_sent' && trip?.proposal?.preview) {
    const stops = [...trip.proposal.preview.members]
      .sort((a, b) => a.drop_index - b.drop_index)
      .map((m) => ({ lat: m.dest_lat, lng: m.dest_lng, label: m.is_you ? 'You' : m.first_name, isYou: m.is_you }));
    return { airport, stops, route: 'preview', focus: 'route' };
  }

  if (trip?.group) {
    const g = trip.group;
    const stops = [...g.members]
      .sort((a, b) => a.drop_index - b.drop_index)
      .map((m) => ({ lat: m.map_lat, lng: m.map_lng, label: m.is_you ? 'You' : m.first_name, isYou: m.is_you }));
    const pickup = { lat: g.pickup_coords.lat, lng: g.pickup_coords.lng, label: 'Pickup' };
    const atAirport = state === 'landed' || state === 'at_pickup' || state === 'cab_booked';
    return { airport, stops, pickup, route: 'shared', focus: atAirport ? 'pickup' : 'route' };
  }

  return { airport, destination: dest, route: dest ? 'preview' : null, focus: 'route' };
}

// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------
const Modal: React.FC<{ onClose: () => void; label: string; children: React.ReactNode; z?: number }> = ({ onClose, label, children, z = 1150 }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 flex items-end md:items-center justify-center bg-black/60" style={{ zIndex: z }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TRANSITION} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full md:max-w-md rounded-t-[28px] md:rounded-3xl border border-ink-800 bg-ink-950 p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={TRANSITION}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

const NamePrompt: React.FC<{ title: string; action: string; initial: string; onSubmit: (name: string) => void; onClose: () => void }> = ({
  title, action, initial, onSubmit, onClose,
}) => {
  const [name, setName] = useState(initial);
  const valid = name.trim().length >= 2;
  return (
    <Modal onClose={onClose} label={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(name.trim());
        }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-xl font-bold text-primary">{title}</h2>
          <p className="text-secondary">First name only. It’s all the others will see.</p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^\p{L} .'-]/gu, '').slice(0, 30))}
          placeholder="Your first name"
          className="field text-lg"
          autoComplete="given-name"
          data-demo="name-input"
        />
        <button type="submit" className="btn-primary w-full" disabled={!valid} data-demo="name-confirm">
          {action}
        </button>
      </form>
    </Modal>
  );
};

const HandoffSheet: React.FC<{ trip: Trip; onClose: () => void }> = ({ trip, onClose }) => {
  const g = trip.group!;
  const [copied, setCopied] = useState(false);
  const stopsText = g.stops.map((s, i) => `${i + 1}. ${s.first_name}: ${s.address_line ?? s.area}`).join('\n');
  return (
    <Modal onClose={onClose} label="Book in Uber">
      <div className="space-y-4" data-demo="handoff">
        <div>
          <h2 className="text-xl font-bold text-primary">Book one cab for everyone</h2>
          <p className="text-secondary">Uber opens with the pickup and the first stop filled in. Add the other stops in the app.</p>
        </div>
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4 text-sm">
          <div className="flex justify-between gap-3 py-1"><span className="text-secondary">Pickup</span><span className="text-right text-primary">{g.pickup_point}</span></div>
          {g.stops.map((s, i) => (
            <div key={i} className="flex justify-between gap-3 py-1">
              <span className="text-secondary">Stop {i + 1}</span>
              <span className="text-right text-primary">{s.address_line ?? s.area}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 py-1"><span className="text-secondary">Cab size</span><span className="text-primary">{g.cab_name}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(stopsText).then(() => setCopied(true), () => setCopied(true))}>
            <IconCopy /> {copied ? 'Copied' : 'Copy stops'}
          </button>
          <a className="btn-secondary" href={g.uber_link ?? '#'} target="_blank" rel="noreferrer" data-demo="open-uber-app">
            Open Uber
          </a>
        </div>
        <button type="button" className="btn-primary w-full" onClick={onClose} data-demo="handoff-close">
          I’ve booked it
        </button>
      </div>
    </Modal>
  );
};

const InviteOverlay: React.FC<{ invite: ProposalView; left: number; onAccept: () => void; onDecline: () => void; busy: boolean }> = ({
  invite, left, onAccept, onDecline, busy,
}) => {
  const who = invite.members.find((m) => m.is_initiator);
  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-[1100] md:inset-auto md:bottom-6 md:left-6 md:w-[420px]"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={TRANSITION}
      role="dialog"
      aria-label="Cab share invite"
      data-demo="invite-received"
    >
      <div className="rounded-t-[28px] md:rounded-3xl border border-amber/60 bg-ink-950 p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex items-start gap-4">
          <CountdownRing left={left} total={invite.window_seconds} />
          <div>
            <h2 className="text-xl font-bold text-primary">{who?.first_name ?? 'Someone'} wants to share a cab with you</h2>
            <p className="text-sm text-secondary">{invite.why}</p>
          </div>
        </div>
        {invite.saving_inr !== undefined && (
          <div className="flex items-baseline justify-between rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3">
            <span className="text-secondary">You’d save</span>
            <span className="text-2xl font-extrabold text-green tabular-nums">{formatINR(invite.saving_inr, true)}</span>
          </div>
        )}
        <div className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900 px-4">
          {invite.members.filter((m) => !m.is_you).map((m) => (
            <Person key={m.request_id} name={m.first_name} area={m.area} km={m.approx_km_from_you} isDemo={m.is_demo} />
          ))}
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={onDecline} disabled={busy} data-demo="decline-invite">
            No thanks
          </button>
          <button type="button" className="btn-primary" onClick={onAccept} disabled={busy} data-demo="accept-invite">
            Accept
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// -----------------------------------------------------------------------------
// The screen
// -----------------------------------------------------------------------------
interface TripScreenProps {
  config: PublicConfig | null;
  prefill?: StartPrefill;
  controller?: TripController;
}

export const TripScreen: React.FC<TripScreenProps> = ({ config, prefill, controller }) => {
  const own = useTrip();
  const tc = controller ?? own;
  const { trip, state, act, serverNow } = tc;
  const now = useServerNow(serverNow, 1000);
  const isDesktop = useIsDesktop();
  const form = useStartForm(prefill);

  const [snap, setSnap] = useState<Snap>(DEFAULT_SNAP[state]);
  const [sheetPx, setSheetPx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [namePrompt, setNamePrompt] = useState<null | { kind: 'share' | 'accept' }>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [cabInput, setCabInput] = useState('');
  const [cabError, setCabError] = useState<string | null>(null);
  const [fare, setFare] = useState('');
  const [upi, setUpi] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<ImpactMetrics | null>(null);

  useEffect(() => {
    if (!tc.toast) return;
    const t = window.setTimeout(tc.clearToast, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tc.toast]);

  // Each state opens the sheet at its natural height
  useEffect(() => setSnap(DEFAULT_SNAP[state]), [state]);
  useEffect(() => {
    if (trip?.options?.best_id && !trip.options.groups.some((g) => g.id === selectedId)) setSelectedId(trip.options.best_id);
  }, [trip?.options, selectedId]);
  useEffect(() => {
    if (state === 'settle' && trip?.group && !fare) setFare(String(Math.round(trip.group.fare_total_est / 10) * 10));
    if (state === 'done') api.getImpactMetrics().then(setImpact).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const options = trip?.options;
  const selected = options?.groups.find((g) => g.id === selectedId) ?? options?.groups.find((g) => g.id === options.best_id);
  const best = options?.groups.find((g) => g.id === options.best_id);
  const left = (p: ProposalView | null | undefined) => (p ? Math.max(0, Math.round((new Date(p.expires_at).getTime() - now) / 1000)) : 0);

  const copyText = copyFor(trip, state, { serverNow: now, bestSaving: best?.viewer_saving_inr });
  const scene = useMemo(
    () => sceneFor(trip, state, form.place, selectedId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip?.state, trip?.options, trip?.group?.id, trip?.group?.members.length, trip?.proposal?.id, state, form.place, selectedId]
  );

  // ---------------------------------------------------------------- actions
  const findPeople = async () => {
    if (!form.canSubmit) return;
    tc.beginSearch();
    const ok = await act(() => api.createTrip(form.toBody()));
    if (!ok) tc.endSearch();
  };

  const sendInvite = async (firstName?: string) => {
    if (!selected || !trip) return;
    const ids = selected.members.filter((m) => !m.is_you).map((m) => m.request_id);
    setNamePrompt(null);
    await act(
      () => api.sendInvite(ids, firstName),
      (t) => ({
        ...t,
        state: 'invite_sent',
        underlying_state: 'invite_sent',
        proposal: {
          id: 'pending',
          status: 'open',
          time_left_seconds: 120,
          window_seconds: 120,
          expires_at: new Date(serverNow() + 120000).toISOString(),
          why: '',
          my_response: 'accepted',
          i_started: true,
          saving_inr: selected.viewer_saving_inr,
          preview: selected,
          members: selected.members.map((m) => ({
            request_id: m.request_id,
            first_name: m.first_name,
            area: m.zone,
            approx_km_from_you: m.approx_km_from_you ?? 0,
            response: m.is_you ? 'accepted' : 'pending',
            is_initiator: !!m.is_you,
            is_you: !!m.is_you,
            is_demo: m.is_demo,
          })),
        },
      })
    );
  };

  const onShare = () => {
    if (trip?.request?.name_given) sendInvite();
    else setNamePrompt({ kind: 'share' });
  };

  const respond = async (action: 'accept' | 'decline', firstName?: string) => {
    if (!trip?.invite) return;
    const inviteId = trip.invite.id;
    setNamePrompt(null);
    setBusy(true);
    await act(() => api.respondInvite(inviteId, action, firstName), (t) => ({ ...t, invite: null, state: t.underlying_state }));
    setBusy(false);
  };

  const onAccept = () => {
    if (trip?.request?.name_given) respond('accept');
    else setNamePrompt({ kind: 'accept' });
  };

  const setPhase = (status: 'landed' | 'at_pickup' | 'paid' | 'done') => {
    if (!trip?.request) return;
    const id = trip.request.id;
    const nextState: Record<string, DisplayState> = { landed: 'landed', at_pickup: 'at_pickup', paid: 'done', done: 'done' };
    act(
      () => api.updateStatus(id, status),
      (t) => ({
        ...t,
        state: nextState[status] as Trip['state'],
        underlying_state: nextState[status] as Trip['state'],
        request: t.request ? { ...t.request, phase: status } : t.request,
      })
    );
  };

  const saveCab = async () => {
    if (!trip?.group) return;
    setCabError(null);
    const groupId = trip.group.id;
    const res = await act(() => api.setCabNumber(groupId, cabInput), (t) => ({
      ...t,
      state: 'cab_booked',
      underlying_state: 'cab_booked',
      group: t.group ? { ...t.group, cab_number: cabInput.trim() } : t.group,
    }));
    if (!res) setCabError('Enter the number plate, like KA 01 AB 1234.');
  };

  const splitFare = async () => {
    if (!trip?.group) return;
    const amount = parseInt(fare, 10);
    if (!amount || amount < 50) {
      setSettleError('Enter the fare in rupees.');
      return;
    }
    setSettleError(null);
    const groupId = trip.group.id;
    const res = await act(() => api.settle(groupId, amount, upi || undefined));
    if (!res) setSettleError('Check the fare and UPI ID (it looks like name@bank).');
  };

  const newTrip = () => act(() => api.newTrip(), (t) => ({ ...t, state: 'start', underlying_state: 'start', request: null, group: null, options: null, proposal: null }));

  const inviteFromFlight = async () => {
    const link = await act(() => api.createJoinLink());
    if (!link || !trip?.request) return;
    const url = `${window.location.origin}${link.path}`;
    const text = `I land at Bengaluru airport${trip.request.flight_no ? ` on ${trip.request.flight_no}` : ''} soon. Want to share a cab into the city and split the fare? ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const shareSaving = useCallback(() => {
    const g = trip?.group;
    const me = g?.members.find((m) => m.is_you);
    if (!g || !me) return;
    const saved = Math.max(0, me.solo_fare_est - (me.final_share ?? me.fare_share_est));
    const text = `I shared a cab from Bengaluru airport with EcoRide Share and saved ${formatINR(saved, true)}. Our group kept about ${g.co2_saved_kg.toFixed(1)} kg of CO2 out of the air. ${window.location.origin}`;
    if (navigator.share) navigator.share({ text }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }, [trip?.group]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!trip?.group) return;
      const groupId = trip.group.id;
      return act(
        () => api.sendGroupMessage(groupId, text),
        (t) => {
          if (!t.group) return t;
          const curr = new Date().toISOString();
          const optimisticMsg = {
            id: `opt_${Date.now()}`,
            sender_name: t.request?.first_name || 'You',
            text,
            timestamp: curr,
            is_you: true,
          };
          return {
            ...t,
            group: {
              ...t.group,
              messages: [...(t.group.messages || []), optimisticMsg],
            },
          };
        }
      );
    },
    [trip?.group?.id, trip?.request?.first_name, act]
  );

  // ---------------------------------------------------------------- primary action per state
  const g = trip?.group;
  const me = g?.members.find((m) => m.is_you);
  let primary: { label: string; sub?: string; onClick?: () => void; href?: string; disabled?: boolean; demo: string } | null = null;
  switch (state) {
    case 'start':
      primary = { label: 'Find people', onClick: findPeople, disabled: !form.canSubmit, demo: 'find-people' };
      break;
    case 'searching':
      primary = { label: 'Looking…', disabled: true, demo: 'searching' };
      break;
    case 'options':
      primary = selected
        ? { label: 'Share this cab', sub: `Save ${formatINR(selected.viewer_saving_inr, true)}`, onClick: onShare, demo: 'share-cab' }
        : null;
      break;
    case 'no_match':
      primary = { label: 'Invite someone from your flight', onClick: inviteFromFlight, demo: 'invite-flight' };
      break;
    case 'invite_sent':
      primary = {
        label: 'Cancel invite',
        onClick: () => trip?.proposal && trip.proposal.id !== 'pending' && act(() => api.cancelInvite(trip.proposal!.id)),
        demo: 'cancel-invite',
      };
      break;
    case 'invite_received':
      primary = null;
      break;
    case 'confirmed':
      primary = { label: 'I’ve landed', onClick: () => setPhase('landed'), demo: 'landed' };
      break;
    case 'landed':
      primary = { label: 'I’m at the pickup point', onClick: () => setPhase('at_pickup'), demo: 'at-pickup' };
      break;
    case 'at_pickup':
      primary = g?.is_booker
        ? cabInput.trim().length >= 4
          ? { label: 'Share cab number', onClick: saveCab, demo: 'cab-save' }
          : { label: 'Open Uber to book', onClick: () => setHandoffOpen(true), demo: 'open-uber' }
        : { label: 'Waiting for the cab number', disabled: true, demo: 'waiting-cab' };
      break;
    case 'cab_booked':
      primary = g?.is_booker
        ? { label: 'Settle up', sub: 'After the ride', onClick: () => g && act(() => api.startSettle(g.id)), demo: 'settle-up' }
        : { label: 'Share trip with family', onClick: () => document.querySelector<HTMLAnchorElement>('[href^="https://wa.me"]')?.click(), demo: 'share-family' };
      break;
    case 'settle':
      if (g?.is_booker) {
        primary = g.final_fare
          ? { label: 'Finish trip', onClick: () => setPhase('done'), demo: 'finish' }
          : { label: 'Split the fare', onClick: splitFare, demo: 'split-fare' };
      } else {
        primary = g?.final_fare && me?.final_share
          ? { label: 'I’ve paid', sub: `${formatINR(me.final_share)} to ${g.booker_name}`, onClick: () => setPhase('paid'), demo: 'paid' }
          : { label: 'Waiting for the fare', disabled: true, demo: 'waiting-fare' };
      }
      break;
    case 'done':
      primary = { label: 'Share what you saved', onClick: shareSaving, demo: 'share-saving' };
      break;
  }

  // ---------------------------------------------------------------- body per state
  const panelState: DisplayState = state === 'invite_received' ? (trip?.underlying_state ?? 'options') : state;
  let body: React.ReactNode = null;
  if (panelState === 'start') body = <StartForm form={form} config={config} serverNow={now} prefilled={!!prefill?.scheduledArrival} />;
  else if (panelState === 'searching') body = <SearchingPanel trip={trip} />;
  else if (!trip) body = null;
  else if (panelState === 'options' && trip.options?.groups.length)
    body = <OptionsPanel trip={trip} selectedId={selectedId} onSelect={setSelectedId} onChangeTrip={newTrip} />;
  else if (panelState === 'no_match' || panelState === 'options') body = <NoMatchPanel trip={trip} onChangeTrip={newTrip} />;
  else if (panelState === 'invite_sent' && trip.proposal) body = <InviteSentPanel proposal={trip.proposal} left={left(trip.proposal)} />;
  else if (panelState === 'confirmed' && trip.group) body = <ConfirmedPanel trip={trip} serverNow={now} onSendMessage={sendMessage} />;
  else if (panelState === 'landed' && trip.group) body = <LandedPanel trip={trip} onSendMessage={sendMessage} />;
  else if (panelState === 'at_pickup' && trip.group) body = <AtPickupPanel trip={trip} cabInput={cabInput} onCabInput={setCabInput} cabError={cabError} onSendMessage={sendMessage} />;
  else if (panelState === 'cab_booked' && trip.group) body = <CabBookedPanel trip={trip} onSendMessage={sendMessage} />;
  else if (panelState === 'settle' && trip.group) body = <SettlePanel trip={trip} fare={fare} onFare={setFare} upi={upi} onUpi={setUpi} error={settleError} />;
  else if (panelState === 'done' && trip.group) body = <DonePanel trip={trip} totalCo2={impact?.co2_saved_kg} />;

  const reduced = prefersReducedMotion();
  const header = (
    <div aria-live="polite" data-demo="sheet-status" data-state={state}>
      <p className="text-[18px] font-bold leading-snug text-primary">{copyText.status}</p>
      {copyText.next && <p className="mt-1 text-[14px] leading-snug text-secondary">{copyText.next}</p>}
    </div>
  );

  const footer = primary ? (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full h-auto min-h-[56px] py-2.5 flex-col gap-0"
        onClick={primary.onClick}
        disabled={primary.disabled}
        data-demo={primary.demo}
      >
        <span className="text-[17px] font-bold">{primary.label}</span>
        {primary.sub && <span className="text-[13px] font-medium opacity-75">{primary.sub}</span>}
      </button>
      {state === 'start' && form.blocker && form.place && <p className="text-center text-sm text-secondary">{form.blocker}</p>}
      {state === 'start' && <p className="text-center text-xs text-secondary">By continuing you confirm you’re 18+ or travelling with an adult.</p>}
      {state === 'done' && (
        <button type="button" className="btn-quiet w-full justify-center" onClick={newTrip} data-demo="new-trip">
          Start a new trip
        </button>
      )}
      {(state === 'confirmed' || state === 'landed') && g && (
        <button
          type="button"
          className="btn-quiet w-full justify-center text-secondary"
          onClick={() => {
            if (window.confirm('Leave this cab share? The others will be told and their fares recalculated.')) act(() => api.leaveGroup(g.id));
          }}
        >
          Leave this cab share
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="trip-screen fixed inset-x-0 top-14 bottom-16 md:bottom-0 overflow-hidden bg-ink-950" data-demo="trip-screen">
      <TripMap scene={scene} sheetPx={sheetPx} isDesktop={isDesktop} />

      <BottomSheet snap={snap} onSnapChange={setSnap} onHeightChange={setSheetPx} header={header} footer={footer} isDesktop={isDesktop} contentKey={panelState}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={panelState}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={TRANSITION}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </BottomSheet>

      <Portal>
        <AnimatePresence>
          {trip?.invite && state === 'invite_received' && !namePrompt && (
            <InviteOverlay invite={trip.invite} left={left(trip.invite)} busy={busy} onAccept={onAccept} onDecline={() => respond('decline')} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {namePrompt && (
            <NamePrompt
              title="What should the others call you?"
              action={namePrompt.kind === 'share' ? 'Send invite' : 'Accept'}
              initial=""
              onClose={() => setNamePrompt(null)}
              onSubmit={(name) => (namePrompt.kind === 'share' ? sendInvite(name) : respond('accept', name))}
            />
          )}
          {handoffOpen && trip?.group && <HandoffSheet trip={trip} onClose={() => setHandoffOpen(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {tc.toast && (
            <motion.div
              className="fixed left-4 right-4 top-[72px] z-[1300] mx-auto max-w-md rounded-2xl border border-red/50 bg-ink-900 p-4 text-primary shadow-2xl"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={TRANSITION}
              role="alert"
            >
              <div className="flex items-start justify-between gap-3">
                <span>{tc.toast}</span>
                <button type="button" className="btn-quiet shrink-0" onClick={tc.clearToast}>
                  OK
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
};
