import { PLAKSHA, nearestPreset, presetToPlace, samePlace, shortPlaceName } from "@/lib/geo";
import { WA_GROUP_HINT, isWaGroupLink, normalizeWaGroupLink } from "@/lib/links";
import type { CreatePrefill, DirectionFilter } from "@/lib/store";
import { addMinutes, buildWindow, dayKeyLabel, hhmm, istDateKey, nextSlot, toIso } from "@/lib/time";
import type { Place, PoolCreate, Preset, TransitMode, Vehicle } from "@/lib/types";
import { DEFAULT_VEHICLE, MAX_PARTY_SEATS, vehicleLabel, vehicleSeats } from "@/lib/vehicles";

export type PlaceTarget = "origin" | "destination";

export const FLEX_OPTIONS = [15, 30, 45, 60] as const;
export const STEP_TITLES = ["Where to?", "When?", "Your ride"] as const;
export const LAST_STEP = STEP_TITLES.length - 1;
/** Rides can be posted at most this many days ahead (backend rule). */
export const MAX_DAYS_AHEAD = 30;

export interface CreateForm {
  origin: Place | null;
  destination: Place | null;
  /** YYYY-MM-DD in IST. */
  date: string;
  /** "HH:MM" in IST. */
  time: string;
  /** Minutes the creator can wait: the window is time .. time + flex. */
  flex: number;
  vehicle: Vehicle;
  mySeats: number;
  giveSeats: number;
  /** Only sent when the user edited it; otherwise the server picks the default. */
  meetingPoint: string;
  meetingTouched: boolean;
  note: string;
  transitMode: TransitMode;
  transitCode: string;
  transitTime: string;
  whatsappUrl: string;
}

/** Keeps a place name inside the API's 2..80 character rule. */
export function cleanPlace(p: Place): Place {
  const name = p.name.trim().slice(0, 80);
  return { name: name.length >= 2 ? name : "Pinned location", lat: p.lat, lng: p.lng };
}

function plakshaPlace(presets: Preset[]): Place {
  const preset = nearestPreset(presets, PLAKSHA.lat, PLAKSHA.lng);
  return preset ? presetToPlace(preset) : { name: "Plaksha University", lat: PLAKSHA.lat, lng: PLAKSHA.lng };
}

export function initialForm(opts: {
  presets: Preset[];
  direction: DirectionFilter;
  prefill: CreatePrefill | null;
}): CreateForm {
  const plaksha = plakshaPlace(opts.presets);
  let origin: Place | null = opts.prefill?.origin ? cleanPlace(opts.prefill.origin) : null;
  let destination: Place | null = opts.prefill?.destination ? cleanPlace(opts.prefill.destination) : null;
  if (!origin && !destination) {
    if (opts.direction === "in") destination = plaksha;
    else origin = plaksha;
  } else if (!origin && destination && !samePlace(destination, plaksha)) {
    origin = plaksha;
  }

  // The next quarter hour; just before midnight that slot belongs to tomorrow.
  const time = nextSlot(30);
  const date = time < hhmm(new Date()) ? istDateKey(1) : istDateKey(0);
  const seats = vehicleSeats(DEFAULT_VEHICLE);

  return {
    origin,
    destination,
    date,
    time,
    flex: 30,
    vehicle: DEFAULT_VEHICLE,
    mySeats: 1,
    giveSeats: seats - 1,
    meetingPoint: "",
    meetingTouched: false,
    note: "",
    transitMode: "none",
    transitCode: "",
    transitTime: "",
    whatsappUrl: "",
  };
}

/** What the server will use as the pickup point when none is given. */
export function defaultMeetingPoint(origin: Place | null, presets: Preset[]): string {
  if (!origin) return "";
  return nearestPreset(presets, origin.lat, origin.lng)?.pickup ?? origin.name;
}

export function maxMySeats(vehicle: Vehicle): number {
  return Math.min(MAX_PARTY_SEATS, vehicleSeats(vehicle) - 1);
}

export function formWindow(form: CreateForm): { start: string; end: string } {
  return buildWindow(form.date, form.time, addMinutes(form.time, form.flex));
}

/** The first problem on a step, or null when it can be left. */
export function stepError(form: CreateForm, step: number, now = Date.now()): string | null {
  if (step === 0) {
    if (!form.origin) return "Choose where the ride starts";
    if (!form.destination) return "Choose where the ride ends";
    if (samePlace(form.origin, form.destination)) return "Pickup and drop are the same place";
    return null;
  }
  if (step === 1) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return "Pick a day";
    if (!/^\d{2}:\d{2}$/.test(form.time)) return "Pick a time to leave";
    const start = new Date(formWindow(form).start).getTime();
    if (!Number.isFinite(start)) return "Pick a day and a time to leave";
    // The server compares the exact start time, not just the date.
    if (form.date > istDateKey(MAX_DAYS_AHEAD) || start > now + MAX_DAYS_AHEAD * 86_400_000) {
      return `Rides can be posted up to ${MAX_DAYS_AHEAD} days ahead. Pick an earlier day or time`;
    }
    if (start < now - 5 * 60_000) return "That time has already passed. Pick a later one";
    return null;
  }
  const seats = vehicleSeats(form.vehicle);
  if (form.mySeats + form.giveSeats > seats) return `A ${vehicleLabel(form.vehicle)} seats ${seats}`;
  if (form.giveSeats < 1) return "Give at least one seat to others";
  if (form.meetingTouched && form.meetingPoint.trim().length === 1) return "Pickup point should be at least 2 characters";
  if (form.transitMode !== "none" && !form.transitCode.trim()) {
    return `Add the ${form.transitMode} number, or turn the sync off`;
  }
  const wa = normalizeWaGroupLink(form.whatsappUrl);
  if (wa && !isWaGroupLink(wa)) return WA_GROUP_HINT;
  return null;
}

/** True when the step-3 problem sits inside the collapsed "More options". */
export function errorInMoreOptions(form: CreateForm): boolean {
  const seats = vehicleSeats(form.vehicle);
  return form.mySeats + form.giveSeats <= seats && form.giveSeats >= 1 && stepError(form, LAST_STEP) !== null;
}

export function toPoolCreate(form: CreateForm, force = false): PoolCreate {
  const w = formWindow(form);
  const meeting = form.meetingTouched ? form.meetingPoint.trim() : "";
  const transit = form.transitMode !== "none";
  return {
    origin: form.origin as Place,
    destination: form.destination as Place,
    window_start: w.start,
    window_end: w.end,
    vehicle: form.vehicle,
    max_seats: form.mySeats + form.giveSeats,
    my_seats: form.mySeats,
    meeting_point: meeting || null,
    custom_route_note: form.note.trim() || null,
    whatsapp_group_url: normalizeWaGroupLink(form.whatsappUrl) || null,
    transit_mode: form.transitMode,
    transit_code: transit ? form.transitCode.trim() : null,
    transit_time:
      transit && /^\d{2}:\d{2}$/.test(form.transitTime) ? new Date(toIso(form.date, form.transitTime)).toISOString() : null,
    force,
  };
}

/** The one-line recap shown above the primary button; it grows as steps are completed. */
export function summaryLine(form: CreateForm, step: number, presets: Preset[]): string {
  if (!form.origin || !form.destination) return "Pick where you start and where you're going";
  const route = `${shortPlaceName(form.origin, presets)} → ${shortPlaceName(form.destination, presets)}`;
  if (step === 0) return route;
  const when = `${dayKeyLabel(form.date)} ${form.time}–${addMinutes(form.time, form.flex)}`;
  if (step === 1) return `${route} · ${when}`;
  return `${route} · ${when} · ${vehicleLabel(form.vehicle)}, ${form.giveSeats} to give`;
}
