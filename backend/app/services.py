import uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .enums import PoolStatus
from .errors import fail
from .geo import bounding_box, format_distance, haversine_km, is_plaksha, nearest_preset
from .links import format_inr, split_fare, upi_pay_link, wa_link
from .matching import (
    Capacity,
    capacity,
    join_blocker,
    match_rank,
    overlap_minutes,
    windows_overlap,
)
from .models import Pool, PoolMember, User
from .realtime import broadcaster
from .schemas import (
    MatchOut,
    MemberContact,
    MemberOut,
    Place,
    PoolDetail,
    PoolOut,
    PublicUser,
    SettlementLine,
    SettlementOut,
)

IST = ZoneInfo("Asia/Kolkata")
ACTIVE = (PoolStatus.open, PoolStatus.full, PoolStatus.booked)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hhmm(dt: datetime) -> str:
    return dt.astimezone(IST).strftime("%H:%M")


def route_label(pool: Pool) -> str:
    return f"{pool.origin_name} to {pool.dest_name}"


def first_name(user: User) -> str:
    return user.name.split()[0] if user.name else "there"


# --- places and wording -----------------------------------------------------------------------


def direction_of(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    """outbound = leaving Plaksha; inbound = heading to Plaksha; other = neither end is Plaksha."""
    if is_plaksha(origin_lat, origin_lng):
        return "outbound"
    if is_plaksha(dest_lat, dest_lng):
        return "inbound"
    return "other"


def default_meeting_point(origin_name: str, origin_lat: float, origin_lng: float) -> str:
    """The usual gathering spot when the pickup is a preset, else just the pickup's name."""
    preset = nearest_preset(origin_lat, origin_lng)
    return preset["pickup"] if preset else origin_name


def trip_km(pool: Pool) -> float:
    return haversine_km(pool.origin_lat, pool.origin_lng, pool.dest_lat, pool.dest_lng)


def seats_word(n: int) -> str:
    return f"{n} seat{'' if n == 1 else 's'}"


def match_found_message(
    creator_name: str,
    origin_name: str,
    destination_name: str,
    start: datetime,
    seats_open: int,
    origin_distance_km: float,
) -> str:
    who = creator_name.split()[0] if creator_name else "Someone"
    return (
        f"{who} already has a {hhmm(start)} ride from {origin_name} to {destination_name} "
        f"with {seats_word(seats_open)} open, {format_distance(origin_distance_km)} from your pickup. "
        "Join theirs instead?"
    )


def reminder_text(pool: Pool, mins: int, others: list[str]) -> tuple[str, str]:
    """(title, body) for the pre-departure push."""
    with_whom = f" with {', '.join(others)}" if others else ""
    return (
        f"Leaving in {mins}m",
        f"Your {hhmm(pool.window_start)} ride from {pool.origin_name} to {pool.dest_name}{with_whom} "
        f"leaves in {mins}m. Meet at {pool.meeting_point}",
    )


BLOCKER_MESSAGES = {
    "POOL_FULL": "This pool is full.",
    "NOT_ENOUGH_SEATS": "Not enough seats left for your group.",
}


def blocker_message(code: str) -> str:
    return BLOCKER_MESSAGES[code]


# --- derived state --------------------------------------------------------------------------


def pool_capacity(pool: Pool) -> Capacity:
    return capacity(pool.vehicle, pool.max_seats, seats_taken(pool))


def seats_taken(pool: Pool) -> int:
    return sum(m.seats for m in pool.members)


def refresh_derived(pool: Pool) -> None:
    cap = pool_capacity(pool)
    if pool.status in (PoolStatus.open, PoolStatus.full):
        pool.status = PoolStatus.full if cap.seats_open == 0 else PoolStatus.open


def bookable_at(pool: Pool) -> datetime:
    return pool.window_start - timedelta(minutes=get_settings().booking_unlock_minutes)


def can_book(pool: Pool, now: datetime | None = None) -> bool:
    now = now or now_utc()
    if pool.status not in (PoolStatus.open, PoolStatus.full):
        return False
    return pool.status == PoolStatus.full or now >= bookable_at(pool)


# --- serialization ------------------------------------------------------------------------


def _public(u: User) -> PublicUser:
    return PublicUser(id=u.id, name=u.name, batch=u.batch)


def _contact_url(pool: Pool, viewer_id: uuid.UUID | None) -> str | None:
    if viewer_id is None or pool.member(viewer_id) is None:
        return None
    if pool.whatsapp_group_url:
        return pool.whatsapp_group_url
    if pool.creator_id == viewer_id or not pool.creator.phone:
        return None
    text = (
        f"Hi {first_name(pool.creator)}, I'm in your {hhmm(pool.window_start)} "
        f"ride from {route_label(pool)} on TravelTrack"
    )
    return wa_link(pool.creator.phone, text)


def serialize_pool(pool: Pool, viewer_id: uuid.UUID | None = None) -> PoolOut:
    cap = pool_capacity(pool)
    return PoolOut(
        id=pool.id,
        origin=Place(name=pool.origin_name, lat=pool.origin_lat, lng=pool.origin_lng),
        destination=Place(name=pool.dest_name, lat=pool.dest_lat, lng=pool.dest_lng),
        direction=direction_of(pool.origin_lat, pool.origin_lng, pool.dest_lat, pool.dest_lng),
        distance_km=round(trip_km(pool), 1),
        window_start=pool.window_start,
        window_end=pool.window_end,
        custom_route_note=pool.custom_route_note,
        meeting_point=pool.meeting_point
        or default_meeting_point(pool.origin_name, pool.origin_lat, pool.origin_lng),
        max_seats=pool.max_seats,
        vehicle=pool.vehicle,
        vehicle_seats=cap.vehicle_seats,
        status=pool.status,
        seats_taken=cap.seats_taken,
        seats_open=cap.seats_open,
        total_fare=pool.total_fare,
        booked_via=pool.booked_via,
        transit_mode=pool.transit_mode,
        transit_code=pool.transit_code,
        transit_time=pool.transit_time,
        bookable_at=bookable_at(pool),
        creator=_public(pool.creator),
        members=[
            MemberOut(
                user=_public(m.user),
                seats=m.seats,
                is_booker=m.is_booker,
                has_paid=m.has_paid,
                joined_at=m.joined_at,
            )
            for m in pool.members
        ],
        created_at=pool.created_at,
        contact_url=_contact_url(pool, viewer_id),
    )


def serialize_detail(pool: Pool, viewer: User) -> PoolDetail:
    base = serialize_pool(pool, viewer.id).model_dump()
    is_member = pool.member(viewer.id) is not None
    contacts = None
    if is_member:  # phone numbers stay inside the pool
        contacts = [
            MemberContact(
                user_id=m.user_id,
                wa_link=wa_link(m.user.phone) if m.user.phone and m.user_id != viewer.id else None,
            )
            for m in pool.members
        ]
    return PoolDetail(
        **base,
        whatsapp_group_url=pool.whatsapp_group_url if is_member else None,
        member_contacts=contacts,
        can_book=is_member and can_book(pool),
    )


def publish_pool(pool: Pool) -> None:
    broadcaster.publish({"type": "pool.upsert", "pool": serialize_pool(pool).model_dump(mode="json")})


def publish_delete(pool_id: uuid.UUID) -> None:
    broadcaster.publish({"type": "pool.delete", "id": str(pool_id)})


# --- queries --------------------------------------------------------------------------------


def get_pool_or_404(db: Session, pool_id: uuid.UUID, lock: bool = False) -> Pool:
    stmt = select(Pool).where(Pool.id == pool_id)
    if lock:
        stmt = stmt.with_for_update()
    pool = db.scalars(stmt).first()
    if pool is None:
        fail(404, "POOL_NOT_FOUND", "That pool no longer exists")
    return pool


def active_pools(db: Session) -> list[Pool]:
    cutoff = now_utc() - timedelta(minutes=get_settings().archive_after_minutes)
    stmt = (
        select(Pool)
        .where(Pool.status.in_(ACTIVE), Pool.window_end >= cutoff)
        .order_by(Pool.window_start)
    )
    return list(db.scalars(stmt).all())


def find_matches(
    db: Session,
    *,
    origin: Place,
    destination: Place,
    start: datetime,
    end: datetime,
    seats: int,
    transit_code: str | None,
    exclude_user: uuid.UUID | None,
    limit: int = 5,
) -> list[MatchOut]:
    """Open rides that leave around the same time from near `origin` to near `destination`."""
    s = get_settings()
    grace = timedelta(minutes=s.match_grace_minutes)
    radius = s.match_radius_km
    o_lat0, o_lat1, o_lng0, o_lng1 = bounding_box(origin.lat, origin.lng, radius)
    d_lat0, d_lat1, d_lng0, d_lng1 = bounding_box(destination.lat, destination.lng, radius)
    # SQL prefilter: the time test is algebraically identical to max(starts) <= min(ends) + grace,
    # and the boxes are safely larger than the radius. The exact distance check is below.
    stmt = select(Pool).where(
        Pool.status == PoolStatus.open,
        Pool.window_end >= now_utc(),
        Pool.window_start <= end + grace,
        Pool.window_end >= start - grace,
        Pool.origin_lat.between(o_lat0, o_lat1),
        Pool.origin_lng.between(o_lng0, o_lng1),
        Pool.dest_lat.between(d_lat0, d_lat1),
        Pool.dest_lng.between(d_lng0, d_lng1),
    )
    code = " ".join(transit_code.upper().split()) if transit_code else None
    out: list[tuple[tuple, MatchOut]] = []
    for pool in db.scalars(stmt).all():
        if not windows_overlap(start, end, pool.window_start, pool.window_end, grace):
            continue
        origin_km = haversine_km(origin.lat, origin.lng, pool.origin_lat, pool.origin_lng)
        dest_km = haversine_km(destination.lat, destination.lng, pool.dest_lat, pool.dest_lng)
        if origin_km > radius or dest_km > radius:
            continue
        if exclude_user and pool.member(exclude_user):
            continue
        if join_blocker(pool.vehicle, pool.max_seats, seats_taken(pool), seats):
            continue
        same = bool(code and pool.transit_code == code)
        out.append(
            (
                match_rank(start, pool.window_start, same, origin_km),
                MatchOut(
                    pool=serialize_pool(pool, exclude_user),
                    overlap_minutes=overlap_minutes(start, end, pool.window_start, pool.window_end),
                    start_delta_minutes=int((pool.window_start - start).total_seconds() // 60),
                    same_transit=same,
                    origin_distance_m=round(origin_km * 1000),
                    destination_distance_m=round(dest_km * 1000),
                ),
            )
        )
    out.sort(key=lambda x: x[0])
    return [m for _, m in out[:limit]]


# --- settlement ------------------------------------------------------------------------------


def member_share(per_seat: Decimal, m: PoolMember) -> Decimal:
    return (per_seat * m.seats).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def build_settlement(pool: Pool) -> SettlementOut:
    """Split the fare per seat; a member holding seats for friends pays for each of them."""
    # A booked ride is archived to `departed` 30 min after its window; the split has to outlive
    # that, so riders can still pay (and be marked paid) once the ride is over.
    booker = pool.booker
    settled = pool.status in (PoolStatus.booked, PoolStatus.departed)
    if not settled or booker is None or pool.total_fare is None:
        fail(409, "NOT_BOOKED", "Nobody has booked this ride yet")
    seats = seats_taken(pool)
    per_seat = split_fare(pool.total_fare, seats)
    note = f"TravelTrack {hhmm(pool.window_start)} {pool.dest_name[:24].strip()}"
    vpa = booker.user.upi_id
    lines = []
    for m in pool.members:
        if m.is_booker:
            continue
        amount = member_share(per_seat, m)
        lines.append(
            SettlementLine(
                user=_public(m.user),
                seats=m.seats,
                amount=format_inr(amount),
                upi_link=upi_pay_link(vpa, booker.user.name, amount, note) if vpa else None,
                has_paid=m.has_paid,
            )
        )
    return SettlementOut(
        total_fare=pool.total_fare,
        seats=seats,
        per_seat=format_inr(per_seat),
        booker=_public(booker.user),
        booker_upi=vpa,
        booked_via=pool.booked_via,
        lines=lines,
    )
