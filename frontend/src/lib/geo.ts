import type { Place, Preset } from "./types";

type LatLng = { lat: number; lng: number };

/** Mirrors backend/app/geo.py. Approximate; check on a map. */
export const PLAKSHA: LatLng = { lat: 30.631, lng: 76.7245 };
export const PLAKSHA_RADIUS_KM = 0.6;
export const PRESET_SNAP_KM = 0.6;
/** Used until /meta has loaded. */
export const DEFAULT_MATCH_RADIUS_KM = 2;

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distance between two points that each have lat/lng. */
export function distanceKm(a: LatLng, b: LatLng): number {
  return haversineKm(a.lat, a.lng, b.lat, b.lng);
}

/** "350 m" below 1 km, otherwise "1.4 km". Mirrors format_distance in backend/app/geo.py. */
export function formatDistance(km: number): string {
  const m = Math.round(km * 1000);
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Same, from metres (MatchOut.origin_distance_m). */
export function formatMeters(m: number): string {
  return formatDistance(m / 1000);
}

export function isPlaksha(lat: number, lng: number): boolean {
  return haversineKm(lat, lng, PLAKSHA.lat, PLAKSHA.lng) <= PLAKSHA_RADIUS_KM;
}

/** The closest preset within `withinKm`, or null. */
export function nearestPreset(presets: Preset[], lat: number, lng: number, withinKm = PRESET_SNAP_KM): Preset | null {
  let best: Preset | null = null;
  let bestKm = Infinity;
  for (const p of presets) {
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (km <= withinKm && km < bestKm) {
      best = p;
      bestKm = km;
    }
  }
  return best;
}

/** Short display name: the preset's short name when the place sits on one, else its own name. */
export function shortPlaceName(place: Place, presets: Preset[]): string {
  return nearestPreset(presets, place.lat, place.lng)?.short ?? place.name;
}

/** Three/four-letter code for ticket-style headings: the preset code, else the first letters of the name. */
export function placeCode(place: Place, presets: Preset[]): string {
  const preset = nearestPreset(presets, place.lat, place.lng);
  if (preset) return preset.code;
  const letters = place.name.replace(/[^A-Za-z0-9]/g, "");
  return (letters.slice(0, 3) || "???").toUpperCase();
}

export function presetToPlace(p: Preset): Place {
  return { name: p.name, lat: p.lat, lng: p.lng };
}

/**
 * Turns a device fix into a place without any network call: the nearest preset when the
 * device is on one, otherwise "Current location" with coordinates rounded to about 11 m.
 * The raw fix is never sent anywhere; the result only leaves the device if the user posts
 * a ride with it as the pickup or drop.
 */
export function deviceFixToPlace(presets: Preset[], fix: LatLng): Place {
  const preset = nearestPreset(presets, fix.lat, fix.lng);
  if (preset) return presetToPlace(preset);
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return { name: "Current location", lat: round(fix.lat), lng: round(fix.lng) };
}

/** Same spot for practical purposes (under 0.3 km apart): the backend rejects such a ride. */
export function samePlace(a: LatLng, b: LatLng): boolean {
  return distanceKm(a, b) < 0.3;
}
