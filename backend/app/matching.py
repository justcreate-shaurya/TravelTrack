"""Pure matching + capacity logic. No DB access here, so it is easy to unit test."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from .enums import Vehicle

DEFAULT_GRACE = timedelta(minutes=15)


def windows_overlap(
    a_start: datetime,
    a_end: datetime,
    b_start: datetime,
    b_end: datetime,
    grace: timedelta = DEFAULT_GRACE,
) -> bool:
    """Two departure windows match if max(start) <= min(end) + grace."""
    return max(a_start, b_start) <= min(a_end, b_end) + grace


def overlap_minutes(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> int:
    """Actual shared minutes (0 when they only match through the grace buffer)."""
    delta = min(a_end, b_end) - max(a_start, b_start)
    return max(0, int(delta.total_seconds() // 60))


# --- Seats ----------------------------------------------------------------------------------
#
# Capacity is seats only. Seats are passenger seats (driver excluded).


@dataclass(frozen=True)
class VehicleRule:
    seats: int  # passenger seats


# Mirrored in frontend/src/lib/vehicles.ts.
VEHICLE_RULES: dict[Vehicle, VehicleRule] = {
    Vehicle.auto: VehicleRule(seats=3),
    Vehicle.sedan: VehicleRule(seats=4),
    Vehicle.suv: VehicleRule(seats=6),
    Vehicle.muv: VehicleRule(seats=7),
}


@dataclass(frozen=True)
class Capacity:
    vehicle_seats: int
    seats_taken: int
    seats_open: int


def seat_limit(vehicle: Vehicle, max_seats: int) -> int:
    """Seats the pool can fill: what the creator asked for, capped by the car."""
    return min(max_seats, VEHICLE_RULES[vehicle].seats)


def capacity(vehicle: Vehicle, max_seats: int, seats_taken: int) -> Capacity:
    return Capacity(
        vehicle_seats=VEHICLE_RULES[vehicle].seats,
        seats_taken=seats_taken,
        seats_open=max(0, seat_limit(vehicle, max_seats) - seats_taken),
    )


def join_blocker(vehicle: Vehicle, max_seats: int, seats_taken: int, add_seats: int) -> str | None:
    """Return a reason code if a group of `add_seats` can't fit, else None."""
    if capacity(vehicle, max_seats, seats_taken).seats_open == 0:
        return "POOL_FULL"
    if seats_taken + add_seats > seat_limit(vehicle, max_seats):
        return "NOT_ENOUGH_SEATS"
    return None


def match_rank(
    my_start: datetime, their_start: datetime, same_transit: bool, origin_km: float = 0.0
) -> tuple[int, float, float]:
    """Sort key: same train/flight first, then the closest start time, then the nearer pickup."""
    return (
        0 if same_transit else 1,
        abs((their_start - my_start).total_seconds()),
        origin_km,
    )
