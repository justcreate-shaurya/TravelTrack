import uuid
from typing import Literal
from datetime import datetime, timedelta, timezone

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from .enums import VEHICLE_LABELS, BookedVia, PoolStatus, TransitMode, Vehicle
from .geo import haversine_km
from .links import UPI_RE, WA_GROUP_RE, normalize_phone
from .matching import VEHICLE_RULES

Direction = Literal["outbound", "inbound", "other"]

MAX_WINDOW = timedelta(hours=6)
MAX_ADVANCE = timedelta(days=30)
PAST_TOLERANCE = timedelta(minutes=10)
MIN_TRIP_KM = 0.3


# --- auth / users -------------------------------------------------------------------------


class MicrosoftLoginIn(BaseModel):
    id_token: str = Field(min_length=20)
    nonce: str = Field(min_length=8, max_length=128)


class DevLoginIn(BaseModel):
    email: str
    name: str | None = None


class PublicUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    batch: str | None = None


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str
    phone: str | None
    batch: str | None
    upi_id: str | None
    avatar_url: str | None
    onboarded: bool


class AuthOut(BaseModel):
    token: str
    user: MeOut


class MeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    batch: str | None = None
    upi_id: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v else v

    @field_validator("batch")
    @classmethod
    def _batch(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        v = v.strip()
        if not (v.isdigit() and len(v) == 4 and v.startswith("20")):
            raise ValueError("Batch should be a graduating year like 2029")
        return v

    @field_validator("upi_id")
    @classmethod
    def _upi(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        v = v.strip()
        if not UPI_RE.match(v):
            raise ValueError("That doesn't look like a UPI ID (name@bank)")
        return v


# --- pools --------------------------------------------------------------------------------


def check_wa_group_url(v: str | None) -> str | None:
    if v in (None, ""):
        return None
    v = v.strip()
    if not WA_GROUP_RE.match(v):
        raise ValueError("Paste a WhatsApp group invite link (https://chat.whatsapp.com/...)")
    return v


class Place(BaseModel):
    """A free-form place: any name plus coordinates."""

    name: str = Field(min_length=2, max_length=80)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

    @field_validator("name", mode="before")
    @classmethod
    def _trim(cls, v):
        return " ".join(v.split()) if isinstance(v, str) else v


class PresetOut(Place):
    key: str
    short: str
    code: str
    pickup: str


class PlaceResult(BaseModel):
    name: str
    detail: str
    lat: float
    lng: float


class _WindowMixin(BaseModel):
    origin: Place
    destination: Place
    window_start: AwareDatetime
    window_end: AwareDatetime

    @model_validator(mode="after")
    def _check_window(self):
        if self.window_end <= self.window_start:
            raise ValueError("Window end must be after window start")
        if self.window_end - self.window_start > MAX_WINDOW:
            raise ValueError("Departure window can be at most 6 hours wide")
        return self


class MatchQuery(_WindowMixin):
    seats: int = Field(default=1, ge=1, le=6)
    transit_code: str | None = Field(default=None, max_length=40)


def clean_meeting_point(v: str | None) -> str | None:
    """Blank means "use the default for this pickup" (filled in by the server)."""
    if v is None or not v.strip():
        return None
    v = v.strip()
    if len(v) < 2:
        raise ValueError("Meeting point should be at least 2 characters")
    return v


class PoolCreate(_WindowMixin):
    vehicle: Vehicle = Vehicle.sedan
    max_seats: int | None = Field(
        default=None, ge=2, le=7, description="Total seats the pool fills (default: 4, or 3 in an auto)"
    )
    my_seats: int = Field(default=1, ge=1, le=6, description="Seats for the creator's group")
    custom_route_note: str | None = Field(default=None, max_length=140)
    meeting_point: str | None = Field(default=None, max_length=80)
    whatsapp_group_url: str | None = None
    transit_mode: TransitMode = TransitMode.none
    transit_code: str | None = Field(default=None, max_length=40)
    transit_time: AwareDatetime | None = None
    force: bool = Field(default=False, description="Create even if a matching pool exists")

    @field_validator("whatsapp_group_url")
    @classmethod
    def _wa(cls, v: str | None) -> str | None:
        return check_wa_group_url(v)

    @field_validator("meeting_point")
    @classmethod
    def _meet(cls, v: str | None) -> str | None:
        return clean_meeting_point(v)

    @field_validator("transit_code")
    @classmethod
    def _code(cls, v: str | None) -> str | None:
        return " ".join(v.upper().split()) if v and v.strip() else None

    @model_validator(mode="after")
    def _check_create(self):
        o, d = self.origin, self.destination
        if haversine_km(o.lat, o.lng, d.lat, d.lng) < MIN_TRIP_KM:
            raise ValueError("Pickup and drop are the same place")
        now = datetime.now(timezone.utc)
        if self.window_end < now - PAST_TOLERANCE:
            raise ValueError("That window is already over")
        if self.window_start > now + MAX_ADVANCE:
            raise ValueError("Pools can be posted at most 30 days ahead")
        vehicle_seats = VEHICLE_RULES[self.vehicle].seats
        if self.max_seats is None:
            self.max_seats = min(4, vehicle_seats)
        if self.max_seats > vehicle_seats:
            raise ValueError(
                f"A {VEHICLE_LABELS[self.vehicle]} seats {vehicle_seats}. Pick a bigger car for more"
            )
        if self.my_seats >= self.max_seats:
            raise ValueError("Give at least one seat to others")
        if self.transit_mode == TransitMode.none:
            self.transit_code = None
            self.transit_time = None
        elif not self.transit_code:
            raise ValueError("Add the train / flight number for Transit Sync")
        return self


class PoolUpdate(BaseModel):
    """Creator-only edits."""

    vehicle: Vehicle | None = None
    max_seats: int | None = Field(default=None, ge=2, le=7)
    meeting_point: str | None = Field(
        default=None, max_length=80, description="Blank or null resets it to the default"
    )
    custom_route_note: str | None = Field(default=None, max_length=140)
    whatsapp_group_url: str | None = None

    @field_validator("whatsapp_group_url")
    @classmethod
    def _wa(cls, v: str | None) -> str | None:
        return check_wa_group_url(v)

    @field_validator("meeting_point")
    @classmethod
    def _meet(cls, v: str | None) -> str | None:
        return clean_meeting_point(v)


class JoinIn(BaseModel):
    seats: int = Field(default=1, ge=1, le=6)


class BookIn(BaseModel):
    total_fare: int = Field(ge=20, le=20000, description="Total fare in rupees")
    booked_via: BookedVia = BookedVia.uber


class PaidIn(BaseModel):
    has_paid: bool = True


class MemberOut(BaseModel):
    user: PublicUser
    seats: int
    is_booker: bool
    has_paid: bool
    joined_at: datetime


class PoolOut(BaseModel):
    id: uuid.UUID
    origin: Place
    destination: Place
    direction: Direction
    distance_km: float
    window_start: datetime
    window_end: datetime
    custom_route_note: str | None
    meeting_point: str
    max_seats: int
    vehicle: Vehicle
    vehicle_seats: int
    status: PoolStatus
    seats_taken: int
    seats_open: int
    total_fare: int | None
    booked_via: BookedVia | None
    transit_mode: TransitMode
    transit_code: str | None
    transit_time: datetime | None
    bookable_at: datetime
    creator: PublicUser
    members: list[MemberOut]
    created_at: datetime
    # Viewer-specific; never included in realtime broadcasts.
    contact_url: str | None = None


class MemberContact(BaseModel):
    user_id: uuid.UUID
    wa_link: str | None


class PoolDetail(PoolOut):
    whatsapp_group_url: str | None = None
    member_contacts: list[MemberContact] | None = None
    can_book: bool = False


class MatchOut(BaseModel):
    pool: PoolOut
    overlap_minutes: int
    start_delta_minutes: int
    same_transit: bool
    origin_distance_m: int
    destination_distance_m: int


class SettlementLine(BaseModel):
    user: PublicUser
    seats: int
    amount: str
    upi_link: str | None
    has_paid: bool


class SettlementOut(BaseModel):
    total_fare: int
    seats: int
    per_seat: str
    booker: PublicUser
    booker_upi: str | None
    booked_via: BookedVia | None
    lines: list[SettlementLine]


class PushSubIn(BaseModel):
    endpoint: str = Field(min_length=10)
    keys: dict[str, str]


class MetaOut(BaseModel):
    ms_client_id: str
    ms_tenant: str  # tenant GUID, or "organizations"
    dev_login: bool
    allowed_domain: str
    vapid_public_key: str
    match_grace_minutes: int
    match_radius_km: float
    booking_unlock_minutes: int
