import type { Vehicle } from "./types";

// Keep in sync with backend/app/matching.py VEHICLE_RULES. Capacity is seats only.
export const VEHICLES: Record<Vehicle, { label: string; seats: number; examples: string }> = {
  auto: { label: "Auto", seats: 3, examples: "Auto-rickshaw" },
  sedan: { label: "Cab", seats: 4, examples: "Dzire, Etios" },
  suv: { label: "SUV", seats: 6, examples: "Ertiga, XL6" },
  muv: { label: "MUV", seats: 7, examples: "Innova" },
};

export const VEHICLE_ORDER: Vehicle[] = ["auto", "sedan", "suv", "muv"];

export const DEFAULT_VEHICLE: Vehicle = "sedan";

export const MIN_POOL_SEATS = 2;
export const MAX_POOL_SEATS = 7;
/** Most seats one person can hold. */
export const MAX_PARTY_SEATS = 6;

export function vehicleLabel(v: Vehicle): string {
  return VEHICLES[v].label;
}

export function vehicleSeats(v: Vehicle): number {
  return VEHICLES[v].seats;
}

/** Mirrors backend matching.capacity. */
export function capacity(vehicle: Vehicle, maxSeats: number, seatsTaken: number) {
  const vehicle_seats = VEHICLES[vehicle].seats;
  const cap = Math.min(maxSeats, vehicle_seats);
  return { vehicle_seats, seats_taken: seatsTaken, seats_open: Math.max(0, cap - seatsTaken) };
}

/** Mirrors backend matching.join_blocker. */
export function joinBlocker(
  vehicle: Vehicle,
  maxSeats: number,
  seatsTaken: number,
  addSeats: number,
): "POOL_FULL" | "NOT_ENOUGH_SEATS" | null {
  const cap = Math.min(maxSeats, VEHICLES[vehicle].seats);
  if (cap - seatsTaken <= 0) return "POOL_FULL";
  if (seatsTaken + addSeats > cap) return "NOT_ENOUGH_SEATS";
  return null;
}

/** The smallest vehicle that seats `seats` people. */
export function smallestVehicleFor(seats: number): Vehicle {
  return VEHICLE_ORDER.find((v) => VEHICLES[v].seats >= seats) ?? "muv";
}
