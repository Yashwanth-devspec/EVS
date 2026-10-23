/**
 * src/lib/fare.ts — The same fare model the backend uses (backend/matching.py), computed from /config.
 * Used for the homepage stat line and the calculator, so the numbers on the page come from config.
 */
import { PublicConfig } from '../types';

/** Extra road distance assumed for each additional drop when people head to the same area. */
export const DETOUR_KM_PER_EXTRA_STOP = 2.5;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface FareExample {
  area: string;
  soloKm: number;
  sharedKm: number;
  riders: number;
  fixedFees: number;
  soloFare: number;
  sharedTotal: number;
  perPerson: number;
  saving: number;
  savingPct: number;
}

/** Solo fare vs each person's share when `riders` people head to the same area. */
export function fareExample(config: PublicConfig, areaKey = 'Jayanagar', riders = 3): FareExample {
  const zone = config.zones[areaKey] ?? Object.values(config.zones)[0];
  const t1 = config.airport.terminals.T1 ?? Object.values(config.airport.terminals)[0];
  const fm = config.fare_model;
  const soloKm = haversineKm(t1.lat, t1.lng, zone.lat, zone.lng) * config.matching_rules.road_factor;
  const fixedFees = fm.base + fm.airport_access_fee + fm.toll_fee;
  const soloFare = fixedFees + fm.per_km * soloKm;
  const sharedKm = soloKm + (riders - 1) * DETOUR_KM_PER_EXTRA_STOP;
  const sharedTotal = riders > 1 ? fixedFees + fm.per_km * sharedKm : soloFare;
  const perPerson = sharedTotal / riders;
  const saving = Math.max(0, soloFare - perPerson);
  return {
    area: zone.name,
    soloKm,
    sharedKm: riders > 1 ? sharedKm : soloKm,
    riders,
    fixedFees,
    soloFare,
    sharedTotal,
    perPerson,
    saving,
    savingPct: Math.round((saving / soloFare) * 100),
  };
}

/** Rounds a rupee estimate to the nearest 10, the way every estimate on the site is shown. */
export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}
