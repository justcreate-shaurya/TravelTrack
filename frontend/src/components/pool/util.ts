import type { BookedVia, PoolStatus } from "@/lib/types";

/** Short, readable ride code derived from the pool id, e.g. "TT-4F9A2C". */
export function rideCode(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `TT-${clean.slice(0, 6) || "RIDE"}`;
}

export { firstName } from "@/lib/names";

/** "120.00" -> "120", "133.33" -> "133.33", 1480 -> "1,480". */
export function rupees(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function seatWord(n: number): string {
  return `${n} seat${n === 1 ? "" : "s"}`;
}

export const STATUS_LABEL: Record<PoolStatus, string> = {
  open: "Open",
  full: "Full",
  booked: "Booked",
  departed: "Departed",
};

export const BOOKED_VIA: { value: BookedVia; label: string }[] = [
  { value: "uber", label: "Uber" },
  { value: "ola", label: "Ola" },
  { value: "indrive", label: "inDrive" },
  { value: "rapido", label: "Rapido" },
  { value: "other", label: "Other" },
];

export function bookedViaLabel(v: BookedVia | null): string {
  return BOOKED_VIA.find((b) => b.value === v)?.label ?? "Cab";
}
