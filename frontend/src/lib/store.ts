"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { api, ApiError, configureApi } from "./api";
import { DEFAULT_MATCH_RADIUS_KM } from "./geo";
import type { Me, Meta, Place, Pool, Preset } from "./types";

export type DirectionFilter = "all" | "out" | "in";

export interface Filters {
  direction: DirectionFilter;
  /** YYYY-MM-DD in IST, or null for every day. */
  day: string | null;
  /** Preset key, or null for every place. */
  placeKey: string | null;
}

export type ToastTone = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastState {
  id: number;
  text: string;
  tone: ToastTone;
  action?: ToastAction;
}

export interface UserLocation {
  lat: number;
  lng: number;
  /** Metres. */
  accuracy: number;
  /** Epoch ms of the fix. */
  at: number;
}

/** Optional starting values for the create wizard. */
export interface CreatePrefill {
  origin?: Place;
  destination?: Place;
}

interface State {
  token: string | null;
  me: Me | null;
  pools: Record<string, Pool>;
  loaded: boolean;
  /** The last board load failed and nothing has loaded yet: screens show a retry state. */
  loadError: boolean;
  live: boolean;
  filters: Filters;
  meta: Meta | null;
  presets: Preset[];
  presetsLoaded: boolean;
  createOpen: boolean;
  createPrefill: CreatePrefill | null;
  /**
   * Device location. Memory only: never persisted, never sent to the backend or a geocoder.
   * It leaves the device only as the pickup of a ride the user chooses to post.
   */
  userLocation: UserLocation | null;
  toast: ToastState | null;
  /** The global success moment (animated check), rendered once by the root layout. */
  success: { id: number; label: string } | null;

  setAuth: (token: string, me: Me) => void;
  setMe: (me: Me) => void;
  logout: () => void;
  setPools: (pools: Pool[]) => void;
  /**
   * Stores a pool. Realtime broadcasts are viewer-neutral (no contact link), so by default the
   * contact link we already have is kept. Pass `viewerSpecific` for a pool that came from a
   * request made as this user (GET /pools/{id}, join, PATCH...): its contact link is authoritative.
   */
  upsertPool: (pool: Pool, viewerSpecific?: boolean) => void;
  removePool: (id: string) => void;
  setLive: (live: boolean) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  openCreate: (prefill?: CreatePrefill) => void;
  closeCreate: () => void;
  setUserLocation: (loc: UserLocation | null) => void;
  showToast: (text: string, tone?: ToastTone, action?: ToastAction) => void;
  clearToast: () => void;
  celebrate: (label: string) => void;
  clearSuccess: () => void;

  refreshPools: () => Promise<void>;
  loadMeta: () => Promise<Meta | null>;
  loadPresets: () => Promise<Preset[]>;
  joinPool: (poolId: string, seats?: number) => Promise<boolean>;
}

/** Realtime broadcasts carry no viewer-specific contact link; keep the one we already have. */
function merge(prev: Pool | undefined, next: Pool, meId?: string): Pool {
  const stillMember = !!meId && next.members.some((m) => m.user.id === meId);
  const contact_url = next.contact_url ?? (stillMember ? prev?.contact_url ?? null : null);
  return { ...next, contact_url };
}

export const DEFAULT_FILTERS: Filters = { direction: "all", day: null, placeKey: null };

let presetsInFlight: Promise<Preset[]> | null = null;
let metaInFlight: Promise<Meta | null> | null = null;
let seq = 0;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      token: null,
      me: null,
      pools: {},
      loaded: false,
      loadError: false,
      live: false,
      filters: { ...DEFAULT_FILTERS },
      meta: null,
      presets: [],
      presetsLoaded: false,
      createOpen: false,
      createPrefill: null,
      userLocation: null,
      toast: null,
      success: null,

      setAuth: (token, me) => set({ token, me }),
      setMe: (me) => set({ me }),
      logout: () =>
        set({
          token: null,
          me: null,
          pools: {},
          loaded: false,
          loadError: false,
          createOpen: false,
          createPrefill: null,
          userLocation: null,
        }),
      setPools: (pools) => set({ pools: Object.fromEntries(pools.map((p) => [p.id, p])), loaded: true, loadError: false }),
      upsertPool: (pool, viewerSpecific = false) =>
        set((s) => {
          if (pool.status === "departed") {
            const { [pool.id]: _, ...rest } = s.pools;
            return { pools: rest };
          }
          const next = viewerSpecific ? pool : merge(s.pools[pool.id], pool, s.me?.id);
          return { pools: { ...s.pools, [pool.id]: next } };
        }),
      removePool: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.pools;
          return { pools: rest };
        }),
      setLive: (live) => set({ live }),
      setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
      openCreate: (prefill) => set({ createOpen: true, createPrefill: prefill ?? null }),
      closeCreate: () => set({ createOpen: false, createPrefill: null }),
      setUserLocation: (userLocation) => set({ userLocation }),
      showToast: (text, tone = "info", action) => set({ toast: { id: ++seq, text, tone, action } }),
      clearToast: () => set({ toast: null }),
      celebrate: (label) => set({ success: { id: ++seq, label } }),
      clearSuccess: () => set({ success: null }),

      /** Rejects on failure; `loadError` is set so a screen with nothing loaded can offer a retry. */
      refreshPools: async () => {
        set({ loadError: false });
        try {
          get().setPools(await api.pools());
        } catch (e) {
          set({ loadError: true });
          throw e;
        }
      },

      /** /meta, fetched once. Resolves null (and can be retried) if the request fails. */
      loadMeta: () => {
        const cached = get().meta;
        if (cached) return Promise.resolve(cached);
        metaInFlight ??= api
          .meta()
          .then((meta) => {
            set({ meta });
            return meta as Meta | null;
          })
          .catch(() => null)
          .finally(() => {
            metaInFlight = null;
          });
        return metaInFlight;
      },

      /** /places/presets, fetched once and cached. Resolves [] (and can be retried) if the request fails. */
      loadPresets: () => {
        const s = get();
        if (s.presetsLoaded) return Promise.resolve(s.presets);
        presetsInFlight ??= api
          .presets()
          .then((presets) => {
            set({ presets, presetsLoaded: true });
            return presets;
          })
          .catch(() => [] as Preset[])
          .finally(() => {
            presetsInFlight = null;
          });
        return presetsInFlight;
      },

      /** Optimistic seat-join: the seats fill instantly and roll back (with an error toast) if the server says no. */
      joinPool: async (poolId, seats = 1) => {
        const { pools, me } = get();
        const prev = pools[poolId];
        if (!prev || !me) return false;
        const seatsOpen = Math.max(0, prev.seats_open - seats);
        const optimistic: Pool = {
          ...prev,
          seats_taken: prev.seats_taken + seats,
          seats_open: seatsOpen,
          status: seatsOpen === 0 && prev.status === "open" ? "full" : prev.status,
          members: [
            ...prev.members,
            {
              user: { id: me.id, name: me.name, batch: me.batch },
              seats,
              is_booker: false,
              has_paid: false,
              joined_at: new Date().toISOString(),
            },
          ],
        };
        set((s) => ({ pools: { ...s.pools, [poolId]: optimistic } }));
        try {
          const fresh = await api.join(poolId, seats);
          set((s) => ({ pools: { ...s.pools, [poolId]: fresh } }));
          return true;
        } catch (e) {
          // Roll back only our optimistic copy; a realtime update may have replaced it meanwhile.
          set((s) => (s.pools[poolId] === optimistic ? { pools: { ...s.pools, [poolId]: prev } } : {}));
          get().showToast(e instanceof ApiError ? e.message : "Couldn't join", "error");
          // The snapshot we rolled back to may itself be stale (the ride filled up or was removed
          // while the socket was down), so bring this ride back in line with the server.
          if (e instanceof ApiError && e.status === 404) get().removePool(poolId);
          else
            api
              .pool(poolId)
              .then((fresh) => get().upsertPool(fresh, true))
              .catch((err) => {
                if (err instanceof ApiError && err.status === 404) get().removePool(poolId);
              });
          return false;
        }
      },
    }),
    {
      name: "traveltrack",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // A chosen day goes stale overnight, so it is never written to disk. Location is never persisted.
      partialize: (s) => ({ token: s.token, me: s.me, filters: { ...s.filters, day: null } }),
      // v2: places became free-form; the corridor/day filters were replaced, so filters reset.
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { token?: string | null; me?: Me | null };
        return { token: old.token ?? null, me: old.me ?? null, filters: { ...DEFAULT_FILTERS } } as unknown as State;
      },
    },
  ),
);

/** Match radius from /meta, with the default until it has loaded. */
export function useMatchRadiusKm(): number {
  return useStore((s) => s.meta?.match_radius_km ?? DEFAULT_MATCH_RADIUS_KM);
}

configureApi({
  getToken: () => useStore.getState().token,
  onUnauthorized: () => useStore.getState().logout(),
});
