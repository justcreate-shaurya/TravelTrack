// Everything is shown in campus time (IST) regardless of the device's zone.
export const TZ = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TZ,
});
const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TZ,
});

export function hhmm(iso: string | Date): string {
  return timeFmt.format(new Date(iso));
}

/** YYYY-MM-DD in IST. */
export function dateKey(d: string | Date): string {
  return dateKeyFmt.format(new Date(d));
}

export function istDateKey(offsetDays = 0): string {
  return dateKey(new Date(Date.now() + offsetDays * 86_400_000));
}

export function dayLabel(iso: string | Date): string {
  const k = dateKey(iso);
  if (k === istDateKey(0)) return "Today";
  if (k === istDateKey(1)) return "Tomorrow";
  return dayFmt.format(new Date(iso));
}

/** IST date + "HH:MM" -> ISO string with offset. */
export function toIso(date: string, time: string): string {
  return `${date}T${time}:00${IST_OFFSET}`;
}

/** Build a window; an end earlier than the start rolls over to the next day. */
export function buildWindow(date: string, start: string, end: string): { start: string; end: string } {
  const s = new Date(toIso(date, start));
  let e = new Date(toIso(date, end));
  if (e <= s) e = new Date(e.getTime() + 86_400_000);
  return { start: s.toISOString(), end: e.toISOString() };
}

/** Next quarter hour (+15 min lead) in IST as HH:MM. */
export function nextSlot(leadMinutes = 30): string {
  const t = new Date(Date.now() + leadMinutes * 60_000);
  const m = Math.ceil(t.getUTCMinutes() / 15) * 15;
  t.setUTCMinutes(m, 0, 0);
  return hhmm(t);
}

export function addMinutes(hm: string, minutes: number): string {
  const [h, m] = hm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function minutesUntil(iso: string, now = Date.now()): number {
  return Math.round((new Date(iso).getTime() - now) / 60_000);
}

/** "in 2h", "in 20m", "in 1h 15m", "now", "12m ago". */
export function relative(iso: string, now = Date.now()): string {
  const mins = minutesUntil(iso, now);
  if (Math.abs(mins) < 1) return "now";
  const abs = Math.abs(mins);
  let s: string;
  if (abs < 60) s = `${abs}m`;
  else if (abs < 24 * 60) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    s = m && h < 4 ? `${h}h ${m}m` : `${h}h`;
  } else s = `${Math.round(abs / 1440)}d`;
  return mins > 0 ? `in ${s}` : `${s} ago`;
}

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ });
const dayNumFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TZ });

export interface StripDay {
  /** YYYY-MM-DD in IST. */
  key: string;
  /** "Thu" */
  weekday: string;
  /** "12" */
  day: string;
  /** "Nov" */
  month: string;
  isToday: boolean;
}

/** Today and the following days in IST, for the date strip. */
export function nextDays(count = 7, now = Date.now()): StripDay[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now + i * 86_400_000);
    return {
      key: dateKey(d),
      weekday: weekdayFmt.format(d),
      day: dayNumFmt.format(d),
      month: monthFmt.format(d),
      isToday: i === 0,
    };
  });
}

/** The 7-day strip: today plus the next six days (IST). */
export function next7Days(now = Date.now()): StripDay[] {
  return nextDays(7, now);
}

/** "Today", "Tomorrow" or "Thu 12 Nov" for a YYYY-MM-DD IST key. */
export function dayKeyLabel(key: string): string {
  return dayLabel(`${key}T12:00:00${IST_OFFSET}`);
}

/** "25m", "1h", "1h 20m" from a number of minutes. */
export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** Width of a pool's departure window in minutes. */
export function windowMinutes(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

/** "17:30 – 18:00" in IST. */
export function windowLabel(startIso: string, endIso: string): string {
  return `${hhmm(startIso)} – ${hhmm(endIso)}`;
}
