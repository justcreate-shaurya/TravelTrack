"use client";

import { useCallback, useEffect, useState } from "react";

import { useStore, type UserLocation } from "./store";

export type GeoStatus =
  /** Not checked yet (first render). */
  | "unknown"
  /** The browser will ask when request() is called. */
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export interface Geolocation {
  status: GeoStatus;
  location: UserLocation | null;
  loading: boolean;
  /** Human-readable reason the last request failed. */
  error: string | null;
  /** Ask for the position. Call only from a user gesture (tap). Resolves null on failure. */
  request: () => Promise<UserLocation | null>;
}

const FRESH_MS = 2 * 60_000;

function locate(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        }),
      reject,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/**
 * Device location, kept in memory in the store. It is never persisted and never sent to the
 * backend or a geocoder. It only leaves the device as the pickup of a ride the user chooses to
 * post ("Post from here" / "Use my current location"), named on the device by deviceFixToPlace.
 * Never prompts on its own: the permission dialog only appears from request(). If the user
 * has already granted access earlier, the position is refreshed silently on mount.
 */
export function useGeolocation(): Geolocation {
  const location = useStore((s) => s.userLocation);
  const setUserLocation = useStore((s) => s.setUserLocation);
  const [status, setStatus] = useState<GeoStatus>("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosition = useCallback(async (): Promise<UserLocation | null> => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("Location isn't available on this device");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const loc = await locate();
      setUserLocation(loc);
      setStatus("granted");
      return loc;
    } catch (e) {
      const code = (e as GeolocationPositionError | undefined)?.code;
      if (code === 1) {
        setStatus("denied");
        setError("Location is blocked. Allow it in your browser settings to see rides near you.");
      } else {
        setError("Couldn't get your location. Try again.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [setUserLocation]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    let perm: PermissionStatus | null = null;
    const apply = (state: PermissionState) => {
      if (cancelled) return;
      setStatus(state);
      if (state === "granted") {
        const cur = useStore.getState().userLocation;
        // Already allowed: reading the position shows no dialog.
        if (!cur || Date.now() - cur.at > FRESH_MS) void fetchPosition();
      }
    };
    const onChange = () => perm && apply(perm.state);

    if (!navigator.permissions?.query) {
      setStatus(useStore.getState().userLocation ? "granted" : "prompt");
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        if (cancelled) return;
        perm = p;
        apply(p.state);
        p.addEventListener("change", onChange);
      })
      .catch(() => {
        if (!cancelled) setStatus(useStore.getState().userLocation ? "granted" : "prompt");
      });
    return () => {
      cancelled = true;
      perm?.removeEventListener("change", onChange);
    };
  }, [fetchPosition]);

  return { status, location, loading, error, request: fetchPosition };
}
