/**
 * src/trip/useTrip.ts — The Trip screen's single source of truth.
 *
 * The server decides the state (GET /trip). This hook polls it, keeps the server clock offset
 * (the demo clock can run ahead of real time), holds the "searching" state for at least 1.5 s,
 * and runs every action optimistically with a rollback when the server says no.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Trip, TripStateName } from '../types';

export type DisplayState = TripStateName | 'searching';

export const SEARCHING_MIN_MS = 1500;
export const SESSION_CHANGED = 'ecoride:session-changed';
export const TRIP_CHANGED = 'ecoride:trip-changed';

export function announceTripChanged(): void {
  window.dispatchEvent(new Event(TRIP_CHANGED));
}

function pollInterval(state: DisplayState | undefined): number {
  if (state === 'invite_sent' || state === 'invite_received' || state === 'searching') return 1200;
  if (state === 'at_pickup' || state === 'cab_booked' || state === 'settle') return 1500;
  return 2500;
}

export interface TripController {
  trip: Trip | null;
  state: DisplayState;
  loading: boolean;
  toast: string | null;
  clearToast: () => void;
  serverNow: () => number;
  refresh: () => Promise<Trip | null>;
  /** Run `call` with `optimistic` applied immediately; roll back and show the error if it fails. */
  act: <T>(call: () => Promise<T>, optimistic?: (t: Trip) => Trip) => Promise<T | null>;
  beginSearch: () => void;
  endSearch: () => void;
}

export function useTrip(): TripController {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [searchingSince, setSearchingSince] = useState<number | null>(null);
  const [, force] = useState(0);
  const offsetRef = useRef(0);
  const inFlight = useRef(0);
  const tripRef = useRef<Trip | null>(null);

  const apply = useCallback((t: Trip) => {
    offsetRef.current = new Date(t.server_time).getTime() - Date.now();
    tripRef.current = t;
    setTrip(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const t = await api.getTrip();
      // An optimistic action is still in flight: don't let a stale poll undo it
      if (inFlight.current === 0) apply(t);
      return t;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const searching = searchingSince !== null;
  const rawState: TripStateName = trip?.state ?? 'start';
  const state: DisplayState =
    searching && (rawState === 'start' || rawState === 'options' || rawState === 'no_match') ? 'searching' : rawState;

  // Poll
  useEffect(() => {
    let alive = true;
    let timer: number;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState !== 'hidden') await refresh();
      timer = window.setTimeout(tick, pollInterval(state));
    };
    timer = window.setTimeout(tick, pollInterval(state));
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [refresh, state]);

  // First load, session switches (autopilot / demo reset) and changes made elsewhere
  useEffect(() => {
    refresh();
    const onSession = () => {
      tripRef.current = null;
      setTrip(null);
      setSearchingSince(null);
      refresh();
    };
    const onChange = () => refresh();
    window.addEventListener(SESSION_CHANGED, onSession);
    window.addEventListener(TRIP_CHANGED, onChange);
    return () => {
      window.removeEventListener(SESSION_CHANGED, onSession);
      window.removeEventListener(TRIP_CHANGED, onChange);
    };
  }, [refresh]);

  // Leave "searching" once results are in and it has been visible for at least 1.5 s
  useEffect(() => {
    if (searchingSince === null) return;
    const ready = trip && (trip.state === 'options' || trip.state === 'no_match' || trip.state === 'invite_received');
    const elapsed = Date.now() - searchingSince;
    if (ready && elapsed >= SEARCHING_MIN_MS) {
      setSearchingSince(null);
      return;
    }
    const t = window.setTimeout(() => force((n) => n + 1), Math.max(120, SEARCHING_MIN_MS - elapsed));
    return () => window.clearTimeout(t);
  }, [searchingSince, trip]);

  const act = useCallback(
    async <T,>(call: () => Promise<T>, optimistic?: (t: Trip) => Trip): Promise<T | null> => {
      const before = tripRef.current;
      if (optimistic && before) {
        const next = optimistic(before);
        tripRef.current = next;
        setTrip(next);
      }
      inFlight.current += 1;
      try {
        const result = await call();
        inFlight.current -= 1;
        if (result && typeof result === 'object' && 'state' in (result as any) && 'server_time' in (result as any)) {
          apply(result as unknown as Trip);
        } else {
          await refresh();
        }
        return result;
      } catch (e) {
        inFlight.current -= 1;
        if (before) {
          tripRef.current = before;
          setTrip(before);
        }
        setToast(e instanceof ApiError || e instanceof Error ? e.message : 'That didn’t work. Please try again.');
        refresh();
        return null;
      }
    },
    [apply, refresh]
  );

  return {
    trip,
    state,
    loading,
    toast,
    clearToast: () => setToast(null),
    serverNow: () => Date.now() + offsetRef.current,
    refresh,
    act,
    beginSearch: () => setSearchingSince(Date.now()),
    endSearch: () => setSearchingSince(null),
  };
}

/** Re-renders every `ms` and returns the server-adjusted time. */
export function useServerNow(serverNow: () => number, ms = 1000): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return serverNow();
}
