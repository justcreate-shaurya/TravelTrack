import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .enums import BookedVia, PoolStatus, TransitMode, Vehicle


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always hands back tz-aware UTC datetimes, on Postgres (timestamptz) and SQLite alike."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetime passed to UTCDateTime column")
        value = value.astimezone(timezone.utc)
        if dialect.name == "sqlite":
            value = value.replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def _enum(e, name: str):
    return Enum(e, name=name, values_callable=lambda x: [m.value for m in x])


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), index=True)  # E.164 digits, no '+'
    batch: Mapped[str | None] = mapped_column(String(8))
    upi_id: Mapped[str | None] = mapped_column(String(120))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    @property
    def onboarded(self) -> bool:
        return bool(self.phone)


class Pool(Base):
    __tablename__ = "pools"
    __table_args__ = (
        CheckConstraint("window_end > window_start", name="pool_window_order"),
        CheckConstraint("max_seats BETWEEN 2 AND 7", name="pool_seat_range"),
        Index("ix_pools_window_start", "window_start"),
        Index("ix_pools_status_window_end", "status", "window_end"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Free-form places: any name plus coordinates (presets live in app/geo.py).
    origin_name: Mapped[str] = mapped_column(String(80))
    origin_lat: Mapped[float] = mapped_column(Float)
    origin_lng: Mapped[float] = mapped_column(Float)
    dest_name: Mapped[str] = mapped_column(String(80))
    dest_lat: Mapped[float] = mapped_column(Float)
    dest_lng: Mapped[float] = mapped_column(Float)
    custom_route_note: Mapped[str | None] = mapped_column(Text)
    meeting_point: Mapped[str] = mapped_column(String(80), default="Main Gate")
    window_start: Mapped[datetime] = mapped_column(UTCDateTime)
    window_end: Mapped[datetime] = mapped_column(UTCDateTime)
    max_seats: Mapped[int] = mapped_column(Integer, default=4)
    vehicle: Mapped[Vehicle] = mapped_column(_enum(Vehicle, "vehicle"), default=Vehicle.sedan)
    status: Mapped[PoolStatus] = mapped_column(
        _enum(PoolStatus, "pool_status"), default=PoolStatus.open
    )
    total_fare: Mapped[int | None] = mapped_column(Integer)
    booked_via: Mapped[BookedVia | None] = mapped_column(_enum(BookedVia, "booked_via"))
    booked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    whatsapp_group_url: Mapped[str | None] = mapped_column(Text)

    transit_mode: Mapped[TransitMode] = mapped_column(
        _enum(TransitMode, "transit_mode"), default=TransitMode.none
    )
    transit_code: Mapped[str | None] = mapped_column(String(40), index=True)
    transit_time: Mapped[datetime | None] = mapped_column(UTCDateTime)

    reminder_sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    creator: Mapped[User] = relationship(lazy="selectin")
    members: Mapped[list["PoolMember"]] = relationship(
        back_populates="pool",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PoolMember.joined_at",
    )

    def member(self, user_id: uuid.UUID) -> "PoolMember | None":
        return next((m for m in self.members if m.user_id == user_id), None)

    @property
    def booker(self) -> "PoolMember | None":
        return next((m for m in self.members if m.is_booker), None)


class PoolMember(Base):
    __tablename__ = "pool_members"
    __table_args__ = (CheckConstraint("seats BETWEEN 1 AND 6", name="member_seat_range"),)

    pool_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pools.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    seats: Mapped[int] = mapped_column(Integer, default=1)  # seats this member's group takes
    is_booker: Mapped[bool] = mapped_column(Boolean, default=False)
    has_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    pool: Mapped[Pool] = relationship(back_populates="members")
    user: Mapped[User] = relationship(lazy="selectin")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
