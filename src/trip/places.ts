/**
 * src/trip/places.ts — Small helpers for destinations.
 */
import { GeoResult, PublicConfig } from '../types';

export const AIRPORT = { lat: 13.1986, lng: 77.7066 };
const T1 = { lat: 13.1989, lng: 77.7068, nickname: 'BLR T1 Cab Pickup (Lane 2)' };

/** Uber deep link for booking alone. Only coordinates and an area name go in the URL. */
export function soloUberLink(lat: number, lng: number, area: string): string {
  const q = [
    'action=setPickup',
    `pickup[latitude]=${T1.lat.toFixed(6)}`,
    `pickup[longitude]=${T1.lng.toFixed(6)}`,
    `pickup[nickname]=${encodeURIComponent(T1.nickname)}`,
    `dropoff[latitude]=${lat.toFixed(6)}`,
    `dropoff[longitude]=${lng.toFixed(6)}`,
    `dropoff[nickname]=${encodeURIComponent(`${area}, Bengaluru`)}`,
  ];
  return `https://m.uber.com/ul/?${q.join('&')}`;
}

/** The 16 known areas, as quick chips and as fallback destinations. */
export function areaPlaces(config: PublicConfig | null): GeoResult[] {
  if (!config) return [];
  return Object.entries(config.zones).map(([key, z]) => ({
    id: `area:${key}`,
    name: z.name,
    secondary: 'Area, Bengaluru',
    lat: z.lat,
    lng: z.lng,
    area: z.name,
    accuracy: 'area' as const,
    exact_address: null,
    in_range: true,
    distance_from_airport_km: 0,
    source: 'area',
  }));
}

export const POPULAR_AREAS = [
  'Koramangala',
  'Indiranagar',
  'Whitefield',
  'HSR Layout',
  'Jayanagar',
  'Electronic City',
  'Hebbal',
  'MG Road',
];

export function accuracyLabel(a: GeoResult['accuracy']): string {
  if (a === 'address') return 'Exact address';
  if (a === 'pin') return 'Pin on the map';
  return 'Area';
}
