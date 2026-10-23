/**
 * src/types.ts — TypeScript types for EcoRide Share.
 */

export interface TerminalConfig {
  name: string;
  lat: number;
  lng: number;
  pickup_nickname: string;
}


export interface ZoneConfig {
  name: string;
  lat: number;
  lng: number;
  cluster: string;
}

export interface CabTypeConfig {
  seats: number;
  boot: number;
  multiplier: number;
  name: string;
}

export interface PublicConfig {
  airport: {
    code: string;
    name: string;
    lat: number;
    lng: number;
    terminals: Record<string, TerminalConfig>;
  };
  exit_buffer_min: Record<string, number>;
  tiers: {
    now_max: number;
    soon_max: number;
    later_max: number;
    max_wait_options: number[];
  };
  matching_rules: {
    prefilter_radius_km: number;
    max_detour_ratio: number;
    max_extra_km_per_member: number;
    min_saving_pct: number;
    road_factor: number;
  };
  cab_types: Record<string, CabTypeConfig>;
  fare_model: {
    base: number;
    per_km: number;
    airport_access_fee: number;
    toll_fee: number;
    disclaimer: string;
  };
  environmental: {
    co2_kg_per_km: number;
    tree_kg_per_year: number;
  };
  windows: {
    confirm_window_min: number;
    demo_confirm_window_min: number;
    no_show_grace_min: number;
    purge_after_hours: number;
  };
  zones: Record<string, ZoneConfig>;
  service_radius_km: number;
}

export interface PassengerSession {
  session_id: string;
  first_name: string;
  completed_trips: number;
  noshow_trips: number;
  reliability_score?: number | null;
}

export interface TripRequest {
  id: string;
  first_name: string;
  flight_no: string | null;
  arriving_from: string | null;
  flight_kind: 'domestic' | 'international';
  scheduled_arrival: string;
  delay_min: number;
  terminal: string;
  dest_lat: number;
  dest_lng: number;
  dest_label: string;
  zone: string;
  party_size: number;
  checked_bags: number;
  max_wait_min: number;
  preferred_app: string;
  women_only: boolean;
  status: 'registered' | 'landed' | 'ready_at_pickup' | 'in_group' | 'completed' | 'cancelled' | 'expired';
  phase: 'waiting' | 'landed' | 'at_pickup' | 'paid' | 'done';
  ready_time: string;
  exit_buffer_min: number;
  group_id?: string | null;
  upi_id?: string | null;
  area: string;
  accuracy: Accuracy;
  name_given: boolean;
  exact_address?: string | null;
  drop_detail?: string | null;
}

export interface MatchMember {
  request_id: string;
  first_name: string;
  party_size: number;
  checked_bags: number;
  zone: string;
  dest_label: string;
  dest_lat: number;
  dest_lng: number;
  drop_index: number;
  solo_km: number;
  shared_km_to_drop: number;
  detour_ratio: number;
  extra_wait_min: number;
  solo_fare_est: number;
  fare_share_est: number;
  saving_inr: number;
  saving_pct: number;
  ready_time: string;
  reliability_score?: number | null;
  preferred_app: string;
  is_demo: boolean;
  upi_id?: string | null;
  approx_km_from_you?: number;
  is_you?: boolean;
}

export interface MatchGroup {
  id?: string;
  cab_type: string;
  cab_name: string;
  cab_multiplier: number;
  depart_time: string;
  shared_km: number;
  solo_km_sum: number;
  km_saved: number;
  co2_saved_kg: number;
  trees_equivalent: number;
  fare_total_est: number;
  drop_order: string[];
  members: MatchMember[];
  tier: 'NOW' | 'SOON' | 'LATER';
  viewer_extra_wait_min: number;
  viewer_saving_inr: number;
  viewer_saving_pct: number;
  viewer_share_est: number;
  viewer_solo_est: number;
  avg_reliability: number;
  stops_summary: string[];
}

export interface SoloBaseline {
  solo_km: number;
  solo_fare_est: number;
  cab_type: string;
  ready_time: string;
  uber_link: string;
}

export interface MatchingResult {
  viewer_request_id: string;
  solo_baseline: SoloBaseline;
  tiers: {
    NOW: MatchGroup | null;
    SOON: MatchGroup | null;
    LATER: MatchGroup | null;
  };
  all_valid_groups: MatchGroup[];
}

export interface PoolOutlook {
  total_active_pool: number;
  summary: string;
  by_zone: Record<string, number>;
  by_wave: Record<string, number>;
}

export interface ProposalItem {
  id: string;
  initiator_request_id: string;
  status: 'open' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  time_left_seconds: number;
  responses: Record<string, string>;
  members: { first_name: string; zone: string; id: string }[];
  my_response: string;
}

export interface ImpactMetrics {
  cabs_avoided: number;
  km_saved: number;
  co2_saved_kg: number;
  trees_equivalent: number;
  total_trips_matched: number;
  active_pool_count: number;
  avg_wait_min: number;
  avg_saving_pct: number;
  match_rate_pct: number;
  wave_breakdown: { wave: string; cabs_avoided: number; km_saved: number; co2_kg: number }[];
  zone_demand: Record<string, number>;
  assumptions_note: string;
}

export type Accuracy = 'address' | 'pin' | 'area';

export type TripStateName =
  | 'start'
  | 'options'
  | 'no_match'
  | 'invite_sent'
  | 'invite_received'
  | 'confirmed'
  | 'landed'
  | 'at_pickup'
  | 'cab_booked'
  | 'settle'
  | 'done';

export interface ProposalMemberView {
  request_id: string;
  first_name: string;
  area: string;
  approx_km_from_you: number;
  response: 'pending' | 'accepted' | 'declined';
  is_initiator: boolean;
  is_you: boolean;
  is_demo: boolean;
}

export interface ProposalView {
  id: string;
  status: string;
  time_left_seconds: number;
  window_seconds: number;
  expires_at: string;
  members: ProposalMemberView[];
  why: string;
  my_response: string;
  i_started: boolean;
  saving_inr?: number;
  share_est?: number;
  solo_est?: number;
  extra_wait_min?: number;
  depart_time?: string;
  preview?: MatchGroup;
}

export interface GroupMemberView {
  request_id: string;
  first_name: string;
  area: string;
  approx_km_from_you: number;
  map_lat: number;
  map_lng: number;
  drop_index: number;
  fare_share_est: number;
  solo_fare_est: number;
  final_share: number | null;
  extra_wait_min: number;
  outcome: string;
  phase: TripRequest['phase'];
  is_booker: boolean;
  is_you: boolean;
  is_demo: boolean;
}

export interface GroupStop {
  drop_index: number;
  first_name: string;
  area: string;
  is_you: boolean;
  /** Only present for the person booking, once the group is confirmed. */
  address_line?: string;
}

export interface GroupMessage {
  id: string;
  sender_name: string;
  text: string;
  timestamp: string;
  is_you: boolean;
}

export interface GroupView {
  id: string;
  status: 'confirmed' | 'settling' | 'completed' | 'dissolved';
  cab_type: string;
  cab_name: string;
  pickup_code: string;
  pickup_point: string;
  pickup_coords: { lat: number; lng: number };
  share_token: string;
  depart_time: string;
  shared_km: number;
  solo_km_sum: number;
  km_saved: number;
  co2_saved_kg: number;
  fare_total_est: number;
  at_risk: boolean;
  at_risk_reason?: string | null;
  cab_number: string | null;
  final_fare: number | null;
  booker_upi: string | null;
  is_booker: boolean;
  booker_name: string;
  members: GroupMemberView[];
  stops: GroupStop[];
  uber_link: string | null;
  pay_link: string | null;
  pay_links: Record<string, string | null>;
  messages?: GroupMessage[];
}

export interface TripOptions {
  best_id: string | null;
  needs_longer_wait: boolean;
  groups: MatchGroup[];
  solo: SoloBaseline;
}

export interface Trip {
  server_time: string;
  state: TripStateName;
  underlying_state: TripStateName;
  request: TripRequest | null;
  options: TripOptions | null;
  proposal: ProposalView | null;
  invite: ProposalView | null;
  group: GroupView | null;
  notice: string | null;
  live: { landing_soon: number; heading_your_way: number };
}

export interface GeoResult {
  id?: string;
  name: string;
  secondary: string;
  lat: number;
  lng: number;
  area: string;
  accuracy: Accuracy;
  exact_address: string | null;
  in_range: boolean;
  distance_from_airport_km: number;
  source?: string;
}

export interface GeoSearchResponse {
  results: GeoResult[];
  cached: boolean;
  throttled: boolean;
  message: string | null;
}

export interface ReverseResult extends GeoResult {
  throttled?: boolean;
  message?: string | null;
}
