import type {
  AuthResponse,
  BookedVia,
  Match,
  MatchQuery,
  Me,
  Meta,
  PlaceResult,
  Pool,
  PoolCreate,
  PoolDetail,
  PoolUpdate,
  Preset,
  Settlement,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureApi(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  tokenGetter = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch (e) {
    // A cancelled request (AbortController) is not a network failure; let callers ignore it.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.detail;
    if (res.status === 401) onUnauthorized();
    if (detail && typeof detail === "object" && !Array.isArray(detail) && "code" in detail) {
      const { code, message, ...rest } = detail as { code: string; message: string };
      throw new ApiError(res.status, code, message, rest);
    }
    if (Array.isArray(detail)) {
      // Pydantic validation error: surface the first readable message.
      const msg = String(detail[0]?.msg ?? "Invalid input").replace(/^Value error, /, "");
      throw new ApiError(res.status, "VALIDATION", msg);
    }
    throw new ApiError(res.status, "HTTP_" + res.status, "Something went wrong");
  }
  return body as T;
}

export const api = {
  meta: () => request<Meta>("/meta"),
  microsoftLogin: (id_token: string, nonce: string) =>
    request<AuthResponse>("/auth/microsoft", { method: "POST", json: { id_token, nonce } }),
  devLogin: (email: string) => request<AuthResponse>("/auth/dev", { method: "POST", json: { email } }),
  me: () => request<Me>("/me"),
  updateMe: (body: Partial<Pick<Me, "name" | "phone" | "batch" | "upi_id">>) =>
    request<Me>("/me", { method: "PATCH", json: body }),

  // Places
  presets: () => request<Preset[]>("/places/presets"),
  /** Throws ApiError code GEOCODER_DOWN (502) when the geocoder is unreachable. Pass a signal to cancel stale searches. */
  placeSearch: (q: string, opts: { limit?: number; signal?: AbortSignal } = {}) =>
    request<PlaceResult[]>(`/places/search?q=${encodeURIComponent(q)}&limit=${opts.limit ?? 6}`, {
      signal: opts.signal,
    }),
  /** Names a coordinate: the nearest preset within 0.6 km wins, else the geocoder, else "Pinned location". */
  placeReverse: (lat: number, lng: number, opts: { signal?: AbortSignal } = {}) =>
    request<PlaceResult>(`/places/reverse?lat=${lat}&lng=${lng}`, { signal: opts.signal }),

  // Pools
  pools: () => request<Pool[]>("/pools"),
  pool: (id: string) => request<PoolDetail>(`/pools/${id}`),
  /** Rides the viewer could join instead of posting: same pickup and drop within the match radius, overlapping window. */
  matches: (query: MatchQuery) => request<Match[]>("/pools/matches", { method: "POST", json: query }),
  /** Without `force`, a 409 MATCH_FOUND carries `matches` (see matchesFromError). */
  createPool: (body: PoolCreate) => request<PoolDetail>("/pools", { method: "POST", json: body }),
  updatePool: (id: string, body: PoolUpdate) =>
    request<PoolDetail>(`/pools/${id}`, { method: "PATCH", json: body }),
  deletePool: (id: string) => request<void>(`/pools/${id}`, { method: "DELETE" }),
  join: (id: string, seats = 1) =>
    request<PoolDetail>(`/pools/${id}/join`, { method: "POST", json: { seats } }),
  updateMySeats: (id: string, seats: number) =>
    request<PoolDetail>(`/pools/${id}/me`, { method: "PATCH", json: { seats } }),
  leave: (id: string) =>
    request<{ deleted: boolean; pool?: Pool }>(`/pools/${id}/leave`, { method: "POST" }),
  book: (id: string, total_fare: number, booked_via: BookedVia) =>
    request<PoolDetail>(`/pools/${id}/book`, { method: "POST", json: { total_fare, booked_via } }),
  unbook: (id: string) => request<PoolDetail>(`/pools/${id}/unbook`, { method: "POST" }),
  settlement: (id: string) => request<Settlement>(`/pools/${id}/settlement`),
  markPaid: (id: string, userId: string, has_paid: boolean) =>
    request<Settlement>(`/pools/${id}/members/${userId}/paid`, { method: "POST", json: { has_paid } }),

  pushSubscribe: (sub: PushSubscriptionJSON) => request<void>("/push/subscribe", { method: "POST", json: sub }),
  pushUnsubscribe: (sub: PushSubscriptionJSON) =>
    request<void>("/push/unsubscribe", { method: "POST", json: sub }),
};

/** The matches carried by a 409 MATCH_FOUND from createPool, or null for any other error. */
export function matchesFromError(e: unknown): Match[] | null {
  if (e instanceof ApiError && e.code === "MATCH_FOUND") return (e.data.matches as Match[]) ?? [];
  return null;
}

/** True for a fetch cancelled through an AbortSignal. */
export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** A message fit for a toast from anything thrown by `api`. */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof ApiError ? e.message : fallback;
}
