import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Response
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_onboarded
from ..db import SessionLocal, get_db
from ..enums import VEHICLE_LABELS, PoolStatus
from ..errors import fail
from ..matching import VEHICLE_RULES, join_blocker, seat_limit
from ..models import Pool, PoolMember, User
from ..push import notify_users
from ..schemas import (
    BookIn,
    JoinIn,
    MatchOut,
    MatchQuery,
    PaidIn,
    PoolCreate,
    PoolDetail,
    PoolOut,
    PoolUpdate,
    SettlementOut,
)
from ..services import (
    active_pools,
    blocker_message,
    build_settlement,
    can_book,
    default_meeting_point,
    find_matches,
    first_name,
    get_pool_or_404,
    hhmm,
    match_found_message,
    now_utc,
    publish_delete,
    publish_pool,
    refresh_derived,
    seats_taken,
    serialize_detail,
    serialize_pool,
)

router = APIRouter(prefix="/pools", tags=["pools"])


def _push_later(user_ids: list[uuid.UUID], title: str, body: str, url: str) -> None:
    with SessionLocal() as db:
        notify_users(db, user_ids, title, body, url)


@router.get("", response_model=list[PoolOut])
def list_pools(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [serialize_pool(p, user.id) for p in active_pools(db)]


@router.post("/matches", response_model=list[MatchOut])
def matches(body: MatchQuery, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return find_matches(
        db,
        origin=body.origin,
        destination=body.destination,
        start=body.window_start,
        end=body.window_end,
        seats=body.seats,
        transit_code=body.transit_code,
        exclude_user=user.id,
    )


@router.post("", response_model=PoolDetail, status_code=201)
def create_pool(body: PoolCreate, user: User = Depends(require_onboarded), db: Session = Depends(get_db)):
    if not body.force:
        found = find_matches(
            db,
            origin=body.origin,
            destination=body.destination,
            start=body.window_start,
            end=body.window_end,
            seats=body.my_seats,
            transit_code=body.transit_code,
            exclude_user=user.id,
        )
        if found:
            top = found[0]
            fail(
                409,
                "MATCH_FOUND",
                match_found_message(
                    top.pool.creator.name,
                    top.pool.origin.name,
                    top.pool.destination.name,
                    top.pool.window_start,
                    top.pool.seats_open,
                    top.origin_distance_m / 1000,
                ),
                matches=[m.model_dump(mode="json") for m in found],
            )

    origin, destination = body.origin, body.destination
    pool = Pool(
        creator=user,
        origin_name=origin.name,
        origin_lat=origin.lat,
        origin_lng=origin.lng,
        dest_name=destination.name,
        dest_lat=destination.lat,
        dest_lng=destination.lng,
        window_start=body.window_start,
        window_end=body.window_end,
        max_seats=body.max_seats,
        vehicle=body.vehicle,
        custom_route_note=body.custom_route_note,
        meeting_point=body.meeting_point
        or default_meeting_point(origin.name, origin.lat, origin.lng),
        whatsapp_group_url=body.whatsapp_group_url,
        transit_mode=body.transit_mode,
        transit_code=body.transit_code,
        transit_time=body.transit_time,
        status=PoolStatus.open,
    )
    pool.members.append(PoolMember(user=user, seats=body.my_seats))
    refresh_derived(pool)
    db.add(pool)
    db.commit()
    publish_pool(pool)
    return serialize_detail(pool, user)


@router.get("/{pool_id}", response_model=PoolDetail)
def get_pool(pool_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_detail(get_pool_or_404(db, pool_id), user)


@router.patch("/{pool_id}", response_model=PoolDetail)
def update_pool(
    pool_id: uuid.UUID,
    body: PoolUpdate,
    user: User = Depends(require_onboarded),
    db: Session = Depends(get_db),
):
    pool = get_pool_or_404(db, pool_id, lock=True)
    if pool.creator_id != user.id:
        fail(403, "NOT_CREATOR", "Only the pool creator can edit it")
    if pool.status not in (PoolStatus.open, PoolStatus.full):
        fail(409, "POOL_LOCKED", "This pool is already booked")

    data = body.model_dump(exclude_unset=True)
    vehicle = data.get("vehicle") or pool.vehicle
    vehicle_seats = VEHICLE_RULES[vehicle].seats
    max_seats = data.get("max_seats")
    if max_seats is None:
        # Keep the current seat count, trimmed to what the (new) car can carry.
        max_seats = min(pool.max_seats, vehicle_seats)
    taken = seats_taken(pool)
    if max_seats < taken:
        fail(409, "NOT_ENOUGH_SEATS", "Riders already hold more seats than that")
    if max_seats > vehicle_seats:
        fail(
            422,
            "TOO_MANY_SEATS",
            f"A {VEHICLE_LABELS[vehicle]} seats {vehicle_seats}. Pick a bigger car for more",
        )

    pool.vehicle, pool.max_seats = vehicle, max_seats
    for key in ("meeting_point", "custom_route_note", "whatsapp_group_url"):
        if key in data:
            setattr(pool, key, data[key])
    # A blank / null meeting point (normalised to None by PoolUpdate) means "use the default".
    if not pool.meeting_point:
        pool.meeting_point = default_meeting_point(
            pool.origin_name, pool.origin_lat, pool.origin_lng
        )
    refresh_derived(pool)
    db.commit()
    publish_pool(pool)
    return serialize_detail(pool, user)


@router.post("/{pool_id}/join", response_model=PoolDetail)
def join_pool(
    pool_id: uuid.UUID,
    body: JoinIn,
    user: User = Depends(require_onboarded),
    db: Session = Depends(get_db),
):
    pool = get_pool_or_404(db, pool_id, lock=True)
    if pool.member(user.id):
        fail(409, "ALREADY_MEMBER", "You're already in this pool")
    if pool.window_end < now_utc():
        fail(409, "POOL_EXPIRED", "This pool's window has passed")
    if pool.status != PoolStatus.open:
        code = "POOL_FULL" if pool.status == PoolStatus.full else "POOL_LOCKED"
        fail(409, code, "This pool is no longer taking riders")
    blocker = join_blocker(pool.vehicle, pool.max_seats, seats_taken(pool), body.seats)
    if blocker:
        fail(409, blocker, blocker_message(blocker))

    pool.members.append(PoolMember(user=user, seats=body.seats))
    refresh_derived(pool)
    db.commit()
    publish_pool(pool)
    return serialize_detail(pool, user)


@router.patch("/{pool_id}/me", response_model=PoolDetail)
def update_my_seat(
    pool_id: uuid.UUID,
    body: JoinIn,
    user: User = Depends(require_onboarded),
    db: Session = Depends(get_db),
):
    pool = get_pool_or_404(db, pool_id, lock=True)
    me = pool.member(user.id)
    if me is None:
        fail(409, "NOT_MEMBER", "You're not in this pool")
    if pool.status not in (PoolStatus.open, PoolStatus.full):
        fail(409, "POOL_LOCKED", "This pool is already booked")
    seats_after = seats_taken(pool) - me.seats + body.seats
    if seats_after > seat_limit(pool.vehicle, pool.max_seats):
        fail(409, "NOT_ENOUGH_SEATS", blocker_message("NOT_ENOUGH_SEATS"))
    me.seats = body.seats
    refresh_derived(pool)
    db.commit()
    publish_pool(pool)
    return serialize_detail(pool, user)


@router.post("/{pool_id}/leave")
def leave_pool(
    pool_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pool = get_pool_or_404(db, pool_id, lock=True)
    me = pool.member(user.id)
    if me is None:
        fail(409, "NOT_MEMBER", "You're not in this pool")
    if pool.status == PoolStatus.booked:
        fail(409, "POOL_BOOKED", "The cab is booked. Ask the booker to reopen the pool first")
    if pool.status == PoolStatus.departed and pool.booker is not None:
        # The fare split is still live after the ride; leaving would drop this rider's share.
        fail(409, "POOL_BOOKED", "This ride was booked and has left. Settle your share instead")

    pool.members.remove(me)
    if not pool.members:
        db.delete(pool)
        db.commit()
        publish_delete(pool_id)
        return {"deleted": True}

    if pool.creator_id == user.id:
        pool.creator = pool.members[0].user  # hand over to the earliest joiner
    refresh_derived(pool)
    db.commit()
    publish_pool(pool)
    return {"deleted": False, "pool": serialize_pool(pool, user.id).model_dump(mode="json")}


@router.post("/{pool_id}/book", response_model=PoolDetail)
def book_pool(
    pool_id: uuid.UUID,
    body: BookIn,
    background: BackgroundTasks,
    user: User = Depends(require_onboarded),
    db: Session = Depends(get_db),
):
    pool = get_pool_or_404(db, pool_id, lock=True)
    me = pool.member(user.id)
    if me is None:
        fail(403, "NOT_MEMBER", "Only riders in this pool can book it")
    if pool.status == PoolStatus.booked:
        fail(409, "ALREADY_BOOKED", "Someone already booked this ride")
    if not can_book(pool):
        fail(
            409,
            "NOT_BOOKABLE_YET",
            f"Booking unlocks when the pool is full or at {hhmm(pool.window_start)} minus 30 min",
        )
    if not user.upi_id:
        fail(422, "UPI_REQUIRED", "Add your UPI ID so others can pay you back")

    me.is_booker = True
    pool.status = PoolStatus.booked
    pool.total_fare = body.total_fare
    pool.booked_via = body.booked_via
    pool.booked_at = now_utc()
    for m in pool.members:
        m.has_paid = m.is_booker
    db.commit()
    publish_pool(pool)

    # Each rider's share depends on how many seats their group holds.
    settlement = build_settlement(pool)
    title = f"{first_name(user)} booked your {hhmm(pool.window_start)} cab"
    via = body.booked_via.value.capitalize()
    for line in settlement.lines:
        background.add_task(
            _push_later,
            [line.user.id],
            title,
            f"₹{pool.total_fare} on {via} · your share ₹{line.amount}. Tap to pay.",
            f"/pool/{pool.id}",
        )
    return serialize_detail(pool, user)


@router.post("/{pool_id}/unbook", response_model=PoolDetail)
def unbook_pool(pool_id: uuid.UUID, user: User = Depends(require_onboarded), db: Session = Depends(get_db)):
    pool = get_pool_or_404(db, pool_id, lock=True)
    me = pool.member(user.id)
    if pool.status != PoolStatus.booked or me is None or not me.is_booker:
        fail(403, "NOT_BOOKER", "Only the booker can reopen this pool")
    for m in pool.members:
        m.is_booker = False
        m.has_paid = False
    pool.status = PoolStatus.open
    pool.total_fare = None
    pool.booked_via = None
    pool.booked_at = None
    refresh_derived(pool)
    db.commit()
    publish_pool(pool)
    return serialize_detail(pool, user)


@router.get("/{pool_id}/settlement", response_model=SettlementOut)
def settlement(pool_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pool = get_pool_or_404(db, pool_id)
    if pool.member(user.id) is None:
        fail(403, "NOT_MEMBER", "Only riders in this pool can see the split")
    return build_settlement(pool)


@router.post("/{pool_id}/members/{member_id}/paid", response_model=SettlementOut)
def mark_paid(
    pool_id: uuid.UUID,
    member_id: uuid.UUID,
    body: PaidIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pool = get_pool_or_404(db, pool_id, lock=True)
    target = pool.member(member_id)
    booker = pool.booker
    if target is None or booker is None:
        fail(404, "NOT_FOUND", "Rider not found in a booked pool")
    if user.id not in (member_id, booker.user_id):
        fail(403, "FORBIDDEN", "Only that rider or the booker can update payment")
    if target.is_booker:
        fail(409, "IS_BOOKER", "The booker paid the cab already")
    target.has_paid = body.has_paid
    db.commit()
    publish_pool(pool)
    return build_settlement(pool)


@router.delete("/{pool_id}", status_code=204)
def delete_pool(pool_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pool = get_pool_or_404(db, pool_id, lock=True)
    if pool.creator_id != user.id:
        fail(403, "NOT_CREATOR", "Only the creator can cancel a pool")
    if len(pool.members) > 1:
        fail(409, "HAS_RIDERS", "Others have joined. Leave the pool instead, and it hands over")
    db.delete(pool)
    db.commit()
    publish_delete(pool_id)
    return Response(status_code=204)
