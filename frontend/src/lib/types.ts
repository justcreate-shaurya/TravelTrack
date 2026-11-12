// Mirrors backend/app/schemas.py

export type PoolStatus = "open" | "full" | "booked" | "departed";
export type Vehicle = "auto" | "sedan" | "suv" | "muv";
export type PoolDirection = "outbound" | "inbound" | "other";
export type TransitMode = "none" | "train" | "flight";
export type BookedVia = "uber" | "ola" | "indrive" | "rapido" | "other";

/** A free-form place: any name plus coordinates. */
export interface Place {
  name: string;
  lat: number;
  lng: number;
}

/** A well-known place served by GET /places/presets. */
export interface Preset extends Place {
  key: string;
  short: string;
  code: string;
  /** Default meeting point when a ride starts here. */
  pickup: string;
}

/** A geocoder hit from /places/search or /places/reverse. */
export interface PlaceResult extends Place {
  detail: string;
}

export interface PublicUser {
  id: string;
  name: string;
  batch: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  batch: string | null;
  upi_id: string | null;
  avatar_url: string | null;
  onboarded: boolean;
}

export interface Member {
  user: PublicUser;
  seats: number;
  is_booker: boolean;
  has_paid: boolean;
  joined_at: string;
}

export interface Pool {
  id: string;
  origin: Place;
  destination: Place;
  /** outbound = starts at Plaksha, inbound = ends at Plaksha, other = neither. */
  direction: PoolDirection;
  /** Straight-line distance, one decimal. */
  distance_km: number;
  window_start: string;
  window_end: string;
  custom_route_note: string | null;
  meeting_point: string;
  max_seats: number;
  vehicle: Vehicle;
  vehicle_seats: number;
  status: PoolStatus;
  seats_taken: number;
  seats_open: number;
  total_fare: number | null;
  booked_via: BookedVia | null;
  transit_mode: TransitMode;
  transit_code: string | null;
  transit_time: string | null;
  bookable_at: string;
  creator: PublicUser;
  members: Member[];
  created_at: string;
  /** Viewer-specific; null in realtime broadcasts. */
  contact_url: string | null;
}

export interface PoolDetail extends Pool {
  whatsapp_group_url: string | null;
  member_contacts: { user_id: string; wa_link: string | null }[] | null;
  can_book: boolean;
}

export interface PoolCreate {
  origin: Place;
  destination: Place;
  window_start: string;
  window_end: string;
  vehicle?: Vehicle;
  max_seats: number;
  my_seats: number;
  /** Blank or null falls back to the default for the pickup. */
  meeting_point?: string | null;
  custom_route_note?: string | null;
  whatsapp_group_url?: string | null;
  transit_mode?: TransitMode;
  transit_code?: string | null;
  transit_time?: string | null;
  /** Post even though a matching ride exists. */
  force?: boolean;
}

export interface PoolUpdate {
  vehicle?: Vehicle;
  max_seats?: number;
  /** Blank or null resets it to the default. */
  meeting_point?: string | null;
  custom_route_note?: string | null;
  whatsapp_group_url?: string | null;
}

export interface MatchQuery {
  origin: Place;
  destination: Place;
  window_start: string;
  window_end: string;
  seats?: number;
  transit_code?: string | null;
}

export interface Match {
  pool: Pool;
  overlap_minutes: number;
  start_delta_minutes: number;
  same_transit: boolean;
  origin_distance_m: number;
  destination_distance_m: number;
}

export interface SettlementLine {
  user: PublicUser;
  seats: number;
  amount: string;
  upi_link: string | null;
  has_paid: boolean;
}

export interface Settlement {
  total_fare: number;
  seats: number;
  per_seat: string;
  booker: PublicUser;
  booker_upi: string | null;
  booked_via: BookedVia | null;
  lines: SettlementLine[];
}

export interface Meta {
  ms_client_id: string;
  ms_tenant: string;
  dev_login: boolean;
  allowed_domain: string;
  vapid_public_key: string;
  match_grace_minutes: number;
  booking_unlock_minutes: number;
  match_radius_km: number;
}

export interface AuthResponse {
  token: string;
  user: Me;
}
