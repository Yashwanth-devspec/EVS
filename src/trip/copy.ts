/**
 * src/trip/copy.ts — The one plain "what's happening" and "what happens next" sentence for every state.
 */
import { Trip } from '../types';
import { formatINR, formatCountdown, joinNames } from '../utils';
import { DisplayState } from './useTrip';

export interface SheetCopy {
  status: string;
  next: string;
}

/** People who haven't given a first name yet are stored as "Traveller"; in a sentence they're "someone". */
const inSentence = (name: string) => (name === 'Traveller' || name === 'Passenger' ? 'someone' : name);

export function othersIn(trip: Trip): string[] {
  if (trip.group) return trip.group.members.filter((m) => !m.is_you).map((m) => m.first_name);
  if (trip.proposal) return trip.proposal.members.filter((m) => !m.is_you).map((m) => m.first_name);
  return [];
}

export function copyFor(trip: Trip | null, state: DisplayState, opts: { serverNow: number; bestSaving?: number }): SheetCopy {
  const g = trip?.group;
  const booker = g?.booker_name ?? '';
  switch (state) {
    case 'start':
      return {
        status: 'Share a cab from the airport',
        next: 'Two questions, then we look for people landing around then and going your way.',
      };
    case 'searching': {
      const n = trip?.live.landing_soon ?? 0;
      return {
        status: 'Looking for people heading your way',
        next: n > 0 ? `${n} people land in the next 90 minutes. Checking who’s going your way.` : 'Checking who lands around the same time.',
      };
    }
    case 'options': {
      const count = trip?.options?.groups.length ?? 0;
      return {
        status:
          opts.bestSaving && opts.bestSaving > 0
            ? `Found ${count === 1 ? 'a cab share' : `${count} cab shares`}. The best saves you ${formatINR(opts.bestSaving, true)}.`
            : 'We found people heading your way.',
        next: 'Pick one and we’ll ask the others. Nothing is booked until everyone says yes.',
      };
    }
    case 'no_match':
      return {
        status: 'Nobody heading your way yet. We’ll keep looking until you land.',
        next: 'Invite someone from your flight, or book alone if you’d rather not wait.',
      };
    case 'invite_sent': {
      const p = trip?.proposal;
      const waiting = p?.members.filter((m) => !m.is_you && m.response === 'pending').map((m) => inSentence(m.first_name)) ?? [];
      const left = p ? Math.max(0, p.time_left_seconds) : 0;
      return {
        status: waiting.length ? `Waiting for ${joinNames(waiting)} to say yes` : 'Everyone said yes. Confirming…',
        next: `If everyone agrees within ${formatCountdown(left)}, your cab share is confirmed.`,
      };
    }
    case 'invite_received': {
      const inv = trip?.invite;
      const who = inv?.members.find((m) => m.is_initiator)?.first_name ?? 'Someone';
      return { status: `${who} wants to share a cab with you`, next: inv?.why ?? '' };
    }
    case 'confirmed':
      return {
        status: `You’re sharing with ${joinNames(trip ? othersIn(trip) : [])}`,
        next: 'When you land, tap I’ve landed.',
      };
    case 'landed':
      return {
        status: `Walk to the pickup point. Your code is ${g?.pickup_code ?? ''}.`,
        next: 'Say the code to the others so you know it’s the right group.',
      };
    case 'at_pickup':
      return g?.is_booker
        ? { status: 'You’re booking one cab for everyone', next: 'Book it in Uber, then add the cab number so the others can find it.' }
        : { status: 'Wait for the cab details', next: `${booker} is booking. The cab number will appear here.` };
    case 'cab_booked':
      return {
        status: `Your cab is ${g?.cab_number ?? ''}`,
        next: g?.is_booker ? 'After the ride, tap Settle up to split the real fare.' : `After the ride, ${booker} enters the real fare and you pay your share.`,
      };
    case 'settle': {
      const me = g?.members.find((m) => m.is_you);
      if (g?.is_booker) {
        return g.final_fare
          ? { status: 'Fare split. Collect each share by UPI.', next: 'Tap Finish trip when everyone has paid.' }
          : { status: 'Enter the fare the cab app charged', next: 'We split it the same way as the estimate.' };
      }
      return g?.final_fare && me?.final_share
        ? { status: `Your share is ${formatINR(me.final_share)}`, next: `Pay ${booker} by UPI, then tap I’ve paid.` }
        : { status: `Waiting for ${booker} to enter the fare`, next: 'Your share will appear here.' };
    }
    case 'done':
      return { status: 'Trip done. Thanks for sharing.', next: 'Here’s what you saved. Share it, or start a new trip.' };
    default:
      return { status: '', next: '' };
  }
}
