/**
 * src/api.ts — Typed API client for EcoRide Share.
 * Every request goes to our own backend (/api/*). Geocoding and map tiles are proxied there,
 * so the browser never calls a third-party service directly.
 */
import {
  PublicConfig,
  PassengerSession,
  TripRequest,
  MatchingResult,
  PoolOutlook,
  ImpactMetrics,
  Trip,
  GeoSearchResponse,
  ReverseResult,
} from './types';

const API_BASE = '/api';
const SESSION_KEY = 'ecoride_session_id';

/**
 * A demo phone frame passes ?sid=... so it can be its own traveller. That id is kept
 * in memory only: frames on the same origin share localStorage, so it can't live there.
 */
const frameSessionId: string | null = (() => {
  try {
    const sid = new URLSearchParams(window.location.search).get('sid');
    return sid && /^sess_[A-Za-z0-9_-]{6,48}$/.test(sid) ? sid : null;
  } catch {
    return null;
  }
})();

export function getSessionId(): string | null {
  if (frameSessionId) return frameSessionId;
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeSessionId(id: string): void {
  if (frameSessionId) return;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    // Private mode: the httpOnly cookie still carries the session
  }
}

/** Starts a fresh anonymous traveller (used by the autopilot so a demo never touches a real trip). */
export function startFreshSession(prefix = 'sess_demo_you'): string {
  const id = `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  storeSessionId(id);
  return id;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: any;
  constructor(message: string, status: number, detail?: any) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.code = detail && typeof detail === 'object' ? detail.code : undefined;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const sessId = getSessionId();
  if (sessId) headers.set('X-Session-ID', sessId);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (!res.ok) {
    let message = `Something went wrong (${res.status}). Please try again.`;
    let detail: any;
    try {
      const errJson = await res.json();
      detail = errJson?.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map((d: any) => String(d.msg || '').replace(/^Value error, /, '')).join(', ');
      } else if (detail && typeof detail === 'object' && detail.message) {
        message = detail.message;
      }
    } catch {
      // keep the generic message
    }
    throw new ApiError(message, res.status, detail);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export interface CreateTripBody {
  dest_lat: number;
  dest_lng: number;
  scheduled_arrival: string;
  dest_label?: string;
  area?: string;
  accuracy: 'address' | 'pin' | 'area';
  exact_address?: string | null;
  drop_detail?: string | null;
  flight_no?: string | null;
  flight_kind?: 'domestic' | 'international';
  terminal?: 'T1' | 'T2';
  delay_min?: number;
  party_size?: number;
  checked_bags?: number;
  max_wait_min?: number;
  women_only?: boolean;
  adult_confirmed?: boolean;
  first_name?: string;
}

export const api = {
  getConfig: () => request<PublicConfig>('/config'),

  // ---- The trip ------------------------------------------------------------
  getTrip: () => request<Trip>('/trip'),

  createTrip: async (body: CreateTripBody) => {
    const data = await post<{ id: string; session_id: string; area: string }>('/requests', body);
    if (data.session_id) storeSessionId(data.session_id);
    return data;
  },

  newTrip: () => post<Trip>('/trip/new'),

  updateStatus: (id: string, status: 'landed' | 'at_pickup' | 'paid' | 'done' | 'cancel') =>
    request<{ id: string; status: string; phase: string }>(`/requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateDelay: (id: string, delayMin: number) =>
    request<{ delay_min: number; group_at_risk: boolean }>(`/requests/${id}/delay`, {
      method: 'PATCH',
      body: JSON.stringify({ delay_min: delayMin }),
    }),

  sendInvite: (memberRequestIds: string[], firstName?: string) =>
    post<{ id: string }>('/proposals', { member_request_ids: memberRequestIds, first_name: firstName }),

  respondInvite: (id: string, action: 'accept' | 'decline', firstName?: string) =>
    post<{ status: string; group_id: string | null }>(`/proposals/${id}/respond`, {
      action,
      first_name: firstName,
    }),

  cancelInvite: (id: string) => post<Trip>(`/proposals/${id}/cancel`),

  setCabNumber: (groupId: string, cabNumber: string) =>
    post<Trip>(`/groups/${groupId}/cab`, { cab_number: cabNumber }),

  startSettle: (groupId: string) => post<Trip>(`/groups/${groupId}/settle/start`),

  settle: (groupId: string, finalFare: number, upiId?: string) =>
    post<Trip>(`/groups/${groupId}/settle`, { final_fare: finalFare, upi_id: upiId || null }),

  leaveGroup: (groupId: string) => post<{ group_status: string }>(`/groups/${groupId}/leave`),

  sendGroupMessage: (groupId: string, text: string) =>
    post<Trip>(`/groups/${groupId}/messages`, { text }),

  createJoinLink: () => post<{ token: string; path: string }>('/join-links'),

  readJoinLink: (token: string) =>
    request<{ airport: string; scheduled_arrival: string; terminal: 'T1' | 'T2'; flight_no: string | null }>(
      `/join/${encodeURIComponent(token)}`
    ),

  // ---- Places (all proxied) -------------------------------------------------
  geoSearch: (q: string, signal?: AbortSignal) =>
    request<GeoSearchResponse>(`/geo/search?q=${encodeURIComponent(q)}`, { signal }),

  geoLookup: (q: string) => request<GeoSearchResponse>(`/geo/lookup?q=${encodeURIComponent(q)}`),

  geoReverse: (lat: number, lng: number, signal?: AbortSignal) =>
    request<ReverseResult>(`/geo/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { signal }),

  geoFromLink: (url: string) => post<ReverseResult>('/geo/link', { url }),

  // ---- Public numbers ------------------------------------------------------
  getImpactMetrics: () => request<ImpactMetrics>('/impact'),
  getPoolOutlook: () => request<PoolOutlook>('/pool/outlook'),

  // ---- Legacy endpoints still used by the operations console --------------
  createSession: async (firstName: string) => {
    const data = await post<PassengerSession>('/session', { first_name: firstName });
    if (data.session_id) storeSessionId(data.session_id);
    return data;
  },
  getMyRequest: () => request<{ request: TripRequest | null; session: PassengerSession }>('/requests/me'),
  getMatchingOptions: (id: string) => request<MatchingResult>(`/requests/${id}/options`),

  getAdminAnalytics: (password: string) =>
    request<{
      clock_utc: string;
      offset_minutes: number;
      total_requests: number;
      active_pool: number;
      total_groups: number;
      confirmed_groups: number;
      demand_by_zone: Record<string, number>;
      match_rate_pct: number;
      demo_mode: boolean;
    }>(`/admin/analytics?password=${encodeURIComponent(password)}`),

  // ---- Demo controls -------------------------------------------------------
  demoSeed: () => post<{ message: string; count: number }>('/demo/seed'),
  demoAdvance: (minutes: number = 10) =>
    post<{ message: string; clock_utc: string; offset_minutes: number }>(`/demo/advance?minutes=${minutes}`),
  demoAdvanceToLanding: () => post<{ clock_utc: string; offset_minutes: number }>('/demo/advance-to-landing'),
  demoReset: (scenario: 'full' | 'stage' = 'full') =>
    post<{ message: string; clock_utc: string; count: number }>(`/demo/reset?scenario=${scenario}`),
  demoRespond: () => post<Trip>('/demo/respond'),
  demoInviteMe: () => post<Trip>('/demo/invite-me'),
};
