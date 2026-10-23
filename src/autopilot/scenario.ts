/**
 * src/autopilot/scenario.ts — The 75-second walkthrough, and the named commands steps can call.
 */
import { api, startFreshSession } from '../api';
import { announceTripChanged, SESSION_CHANGED } from '../trip/useTrip';
import { ScenarioStep } from './engine';

export const demoCommands: Record<string, () => Promise<unknown>> = {
  /** Fresh demo world and a fresh anonymous traveller, so a demo never touches a real trip. */
  reset: async () => {
    await api.demoReset('full');
    startFreshSession();
    window.dispatchEvent(new Event(SESSION_CHANGED));
  },
  /** Used inside /demo phone frames: the director already reset the world. */
  refresh: async () => {
    window.dispatchEvent(new Event(SESSION_CHANGED));
  },
  advanceToLanding: async () => {
    await api.demoAdvanceToLanding();
    announceTripChanged();
  },
  scrollTop: async () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  },
};

export const MAIN_SCENARIO: ScenarioStep[] = [
  {
    id: 'problem',
    caption: 'Twelve people land at 11:45 pm, most heading south. Today that’s twelve cabs on the same road.',
    actor: 'system',
    action: [
      { type: 'navigate', path: '/' },
      { type: 'call', name: 'reset' },
      { type: 'call', name: 'scrollTop' },
      { type: 'point', target: 'hero-stat' },
    ],
    waitMs: 5500,
  },
  {
    id: 'open',
    caption: 'Open EcoRide. No account, nothing to download.',
    actor: 'you',
    action: [{ type: 'click', target: 'hero-cta' }, { type: 'waitFor', target: 'where-input' }],
    waitMs: 1200,
  },
  {
    id: 'where',
    caption: 'Say where you’re going: an area, a street or a landmark.',
    actor: 'you',
    action: [
      { type: 'type', target: 'where-input', text: 'Jayanagar' },
      { type: 'click', target: 'where-result-0' },
    ],
    waitMs: 1500,
  },
  {
    id: 'when',
    caption: 'Say when you land. One tap.',
    actor: 'you',
    action: { type: 'click', target: 'land-chip-1' },
    waitMs: 1500,
  },
  {
    id: 'find',
    caption: 'Find people landing around the same time and heading your way.',
    actor: 'you',
    action: [{ type: 'click', target: 'find-people' }, { type: 'waitFor', target: 'trip-searching' }],
    waitMs: 1200,
  },
  {
    id: 'best',
    caption: 'The best match comes first, with what you’d save. The map shows the route.',
    actor: 'system',
    action: [{ type: 'waitFor', target: 'best-match' }, { type: 'point', target: 'best-match' }],
    waitMs: 4000,
  },
  {
    id: 'share',
    caption: 'Share this cab. The others only ever see your first name.',
    actor: 'you',
    action: [
      { type: 'click', target: 'share-cab' },
      { type: 'type', target: 'name-input', text: 'Asha' },
      { type: 'click', target: 'name-confirm' },
      { type: 'waitFor', target: 'trip-invite-sent' },
    ],
    waitMs: 800,
  },
  {
    id: 'accept',
    caption: 'Each person gets an invite and says yes. These are demo travellers.',
    actor: 'demo',
    action: { type: 'waitFor', target: 'trip-confirmed', timeoutMs: 25000 },
    waitMs: 400,
  },
  {
    id: 'confirmed',
    caption: 'Confirmed. You’re booking, so you see everyone’s stops in order.',
    actor: 'system',
    action: { type: 'point', target: 'copy-all-stops' },
    waitMs: 3500,
  },
  {
    id: 'landed',
    caption: 'Skip ahead to landing. Tap I’ve landed.',
    actor: 'you',
    action: [
      { type: 'call', name: 'advanceToLanding' },
      { type: 'click', target: 'landed' },
      { type: 'waitFor', target: 'trip-landed' },
    ],
    waitMs: 3000,
  },
  {
    id: 'pickup',
    caption: 'Walk to the pickup point. Everyone checks the same 4-digit code.',
    actor: 'you',
    action: [{ type: 'click', target: 'at-pickup' }, { type: 'waitFor', target: 'trip-at-pickup' }],
    waitMs: 2500,
  },
  {
    id: 'handoff',
    caption: 'Book one cab for everyone. Uber opens with the pickup and first stop filled in.',
    actor: 'you',
    action: [{ type: 'click', target: 'open-uber' }, { type: 'waitFor', target: 'handoff' }, { type: 'pause', ms: 2600 }, { type: 'click', target: 'handoff-close' }],
    waitMs: 600,
  },
  {
    id: 'cab',
    caption: 'Add the cab number so everyone can find the car.',
    actor: 'you',
    action: [
      { type: 'type', target: 'cab-input', text: 'KA 01 AB 1234' },
      { type: 'click', target: 'cab-save' },
      { type: 'waitFor', target: 'trip-cab-booked' },
    ],
    waitMs: 2800,
  },
  {
    id: 'settle',
    caption: 'After the ride, enter the real fare. Shares are worked out the same way, with UPI links.',
    actor: 'you',
    action: [
      { type: 'click', target: 'settle-up' },
      { type: 'type', target: 'upi-input', text: 'asha@okaxis' },
      { type: 'click', target: 'split-fare' },
      { type: 'waitFor', target: 'finish' },
    ],
    waitMs: 3200,
  },
  {
    id: 'done',
    caption: 'Done. You see what you saved, and the impact numbers go up.',
    actor: 'you',
    action: [{ type: 'click', target: 'finish' }, { type: 'waitFor', target: 'trip-done' }, { type: 'point', target: 'impact-total' }],
    waitMs: 5000,
  },
];
