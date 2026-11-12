"""Domain enums. Member names equal their values so the DB stores the same string either way.

Places are free-form (name + coordinates); the preset list lives in app/geo.py.
"""

import enum


class PoolStatus(str, enum.Enum):
    open = "open"
    full = "full"
    booked = "booked"
    departed = "departed"


class Vehicle(str, enum.Enum):
    auto = "auto"  # auto-rickshaw: 3 seats
    sedan = "sedan"  # regular cab (Dzire, Etios): 4 seats
    suv = "suv"  # Ertiga, XL6: 6 seats
    muv = "muv"  # Innova: 7 seats


VEHICLE_LABELS: dict[Vehicle, str] = {
    Vehicle.auto: "Auto",
    Vehicle.sedan: "Cab",
    Vehicle.suv: "SUV",
    Vehicle.muv: "MUV",
}


class TransitMode(str, enum.Enum):
    none = "none"
    train = "train"
    flight = "flight"


class BookedVia(str, enum.Enum):
    uber = "uber"
    ola = "ola"
    indrive = "indrive"
    rapido = "rapido"
    other = "other"
