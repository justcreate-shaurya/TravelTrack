import { distanceKm } from "./geo";
import type { Filters } from "./store";
import { dateKey } from "./time";
import type { Pool, Preset } from "./types";

type LatLng = { lat: number; lng: number };

export function isMember(pool: Pool, userId: string | undefined | null): boolean {
  return !!userId && pool.members.some((m) => m.user.id === userId);
}

export function mySeats(pool: Pool, userId: string | undefined | null): number {
  return pool.members.find((m) => m.user.id === userId)?.seats ?? 0;
}

/** Soonest first. */
export function sortPools(pools: Pool[]): Pool[] {
  return [...pools].sort((a, b) => a.window_start.localeCompare(b.window_start));
}

/** A pool touches a preset when its pickup or its drop is within the match radius of it. */
export function poolTouchesPlace(pool: Pool, place: LatLng, radiusKm: number): boolean {
  return distanceKm(pool.origin, place) <= radiusKm || distanceKm(pool.destination, place) <= radiusKm;
}

/**
 * Board filters. Direction: "out" = from Plaksha, "in" = to Plaksha; pools with direction
 * "other" only show under "all". Day: IST date of the window start. Place: a preset key.
 * Returns the pools soonest first.
 */
export function filterPools(
  pools: Pool[],
  filters: Filters,
  opts: { presets: Preset[]; radiusKm: number },
): Pool[] {
  const preset = filters.placeKey ? opts.presets.find((p) => p.key === filters.placeKey) : undefined;
  return sortPools(
    pools.filter((p) => {
      if (filters.direction === "out" && p.direction !== "outbound") return false;
      if (filters.direction === "in" && p.direction !== "inbound") return false;
      if (filters.day && dateKey(p.window_start) !== filters.day) return false;
      if (preset && !poolTouchesPlace(p, preset, opts.radiusKm)) return false;
      return true;
    }),
  );
}

export const NEARBY_WINDOW_MINUTES = 180;

export interface NearbyPool {
  pool: Pool;
  /** Device to pickup, km. */
  distanceKm: number;
}

/**
 * "Near you": open rides I am not in whose pickup is within the match radius of the device
 * and that start within the next 3 hours. Computed on the device; the location never leaves it.
 * Closest first.
 */
export function nearbyPools(
  pools: Pool[],
  location: LatLng | null,
  opts: { radiusKm: number; meId?: string | null; now?: number },
): NearbyPool[] {
  if (!location) return [];
  const now = opts.now ?? Date.now();
  const horizon = now + NEARBY_WINDOW_MINUTES * 60_000;
  const out: NearbyPool[] = [];
  for (const pool of pools) {
    if (pool.status !== "open" || pool.seats_open <= 0) continue;
    if (isMember(pool, opts.meId)) continue;
    const start = new Date(pool.window_start).getTime();
    const end = new Date(pool.window_end).getTime();
    if (end < now || start > horizon) continue;
    const km = distanceKm(location, pool.origin);
    if (km <= opts.radiusKm) out.push({ pool, distanceKm: km });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm || a.pool.window_start.localeCompare(b.pool.window_start));
}
