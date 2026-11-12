from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest

from app.enums import VEHICLE_LABELS, Vehicle
from app.geo import (
    PLAKSHA,
    PRESETS,
    bounding_box,
    format_distance,
    haversine_km,
    is_plaksha,
    nearest_preset,
)
from app.links import normalize_phone, split_fare, upi_pay_link, wa_link
from app.matching import (
    VEHICLE_RULES,
    capacity,
    join_blocker,
    match_rank,
    overlap_minutes,
    windows_overlap,
)
from app.services import (
    default_meeting_point,
    direction_of,
    match_found_message,
    reminder_text,
)

IXC = (30.6735, 76.7885)
SECTOR_70 = (30.7000, 76.7200)  # not near any preset

T0 = datetime(2026, 11, 12, 11, 0, tzinfo=timezone.utc)


def at(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


class TestWindowOverlap:
    def test_true_overlap(self):
        assert windows_overlap(at(0), at(30), at(15), at(45))

    def test_touching_windows(self):
        assert windows_overlap(at(0), at(30), at(30), at(60))

    def test_gap_within_grace(self):
        # A ends 17:30, B starts 17:45: 15-minute gap, still a match.
        assert windows_overlap(at(0), at(30), at(45), at(75))

    def test_gap_beyond_grace(self):
        assert not windows_overlap(at(0), at(30), at(46), at(75))

    def test_symmetric(self):
        assert windows_overlap(at(45), at(75), at(0), at(30))
        assert not windows_overlap(at(46), at(75), at(0), at(30))

    def test_overlap_minutes(self):
        assert overlap_minutes(at(0), at(30), at(15), at(45)) == 15
        assert overlap_minutes(at(0), at(30), at(40), at(60)) == 0


class TestGeo:
    def test_haversine(self):
        assert haversine_km(*PLAKSHA, *PLAKSHA) == 0
        assert 7 <= haversine_km(*PLAKSHA, *IXC) <= 8
        assert haversine_km(*PLAKSHA, *IXC) == pytest.approx(haversine_km(*IXC, *PLAKSHA))
        # One degree of latitude is about 111 km.
        assert haversine_km(30, 76, 31, 76) == pytest.approx(111.2, abs=0.3)

    def test_is_plaksha(self):
        assert is_plaksha(*PLAKSHA)
        assert is_plaksha(PLAKSHA[0] + 0.004, PLAKSHA[1])  # ~450 m north
        assert not is_plaksha(PLAKSHA[0] + 0.007, PLAKSHA[1])  # ~780 m north
        assert not is_plaksha(*IXC)

    def test_presets(self):
        assert [p["key"] for p in PRESETS] == [
            "PLAKSHA", "IXC", "CDG", "SASN", "ISBT43", "SEC17", "ELANTE", "CP67", "SEC35"
        ]
        assert all(set(p) == {"key", "name", "short", "code", "lat", "lng", "pickup"} for p in PRESETS)
        assert nearest_preset(*IXC)["key"] == "IXC"
        assert nearest_preset(IXC[0] + 0.003, IXC[1])["key"] == "IXC"
        assert nearest_preset(*SECTOR_70) is None
        assert nearest_preset(*SECTOR_70, within_km=5)["key"] == "CP67"

    def test_bounding_box_contains_the_radius(self):
        lat0, lat1, lng0, lng1 = bounding_box(*PLAKSHA, 2.0)
        assert haversine_km(*PLAKSHA, lat1, PLAKSHA[1]) > 2.0
        assert haversine_km(*PLAKSHA, lat0, PLAKSHA[1]) > 2.0
        assert haversine_km(*PLAKSHA, PLAKSHA[0], lng1) > 2.0
        assert haversine_km(*PLAKSHA, PLAKSHA[0], lng0) > 2.0
        assert haversine_km(*PLAKSHA, lat1, PLAKSHA[1]) < 4.0  # and not absurdly larger

    def test_format_distance(self):
        assert format_distance(0.35) == "350 m"
        assert format_distance(0.0) == "0 m"
        assert format_distance(0.9996) == "1.0 km"
        assert format_distance(1.44) == "1.4 km"


class TestCapacity:
    def test_vehicle_rules(self):
        assert {v.value: r.seats for v, r in VEHICLE_RULES.items()} == {
            "auto": 3, "sedan": 4, "suv": 6, "muv": 7
        }
        assert {v.value: label for v, label in VEHICLE_LABELS.items()} == {
            "auto": "Auto", "sedan": "Cab", "suv": "SUV", "muv": "MUV"
        }

    def test_capacity(self):
        c = capacity(Vehicle.sedan, 4, 1)
        assert (c.vehicle_seats, c.seats_taken, c.seats_open) == (4, 1, 3)
        assert capacity(Vehicle.sedan, 4, 4).seats_open == 0
        assert capacity(Vehicle.suv, 6, 4).seats_open == 2
        assert capacity(Vehicle.muv, 7, 2).seats_open == 5
        assert capacity(Vehicle.auto, 3, 1).seats_open == 2

    def test_max_seats_clamped_to_vehicle(self):
        assert capacity(Vehicle.sedan, 6, 1).seats_open == 3
        assert capacity(Vehicle.auto, 4, 3).seats_open == 0
        assert capacity(Vehicle.sedan, 4, 5).seats_open == 0  # never negative

    def test_join_blockers(self):
        assert join_blocker(Vehicle.sedan, 4, 4, 1) == "POOL_FULL"
        assert join_blocker(Vehicle.sedan, 4, 3, 2) == "NOT_ENOUGH_SEATS"
        assert join_blocker(Vehicle.sedan, 4, 1, 3) is None  # party of 3 fills the car
        assert join_blocker(Vehicle.suv, 6, 4, 2) is None
        assert join_blocker(Vehicle.suv, 4, 3, 2) == "NOT_ENOUGH_SEATS"  # creator asked for 4 only
        assert join_blocker(Vehicle.auto, 3, 1, 3) == "NOT_ENOUGH_SEATS"
        assert join_blocker(Vehicle.auto, 3, 1, 2) is None

    def test_match_rank(self):
        same_flight_later = match_rank(at(0), at(20), True, 1.5)
        same_time_near = match_rank(at(0), at(0), False, 0.2)
        same_time_far = match_rank(at(0), at(0), False, 1.2)
        later = match_rank(at(0), at(10), False, 0.0)
        assert sorted([later, same_time_far, same_time_near, same_flight_later]) == [
            same_flight_later, same_time_near, same_time_far, later
        ]


class TestWording:
    def _pool(self, origin, dest, meet):
        return SimpleNamespace(origin_name=origin, dest_name=dest, window_start=T0, meeting_point=meet)

    def test_direction(self):
        assert direction_of(*PLAKSHA, *IXC) == "outbound"
        assert direction_of(*IXC, *PLAKSHA) == "inbound"
        assert direction_of(*IXC, *SECTOR_70) == "other"
        assert direction_of(PLAKSHA[0] + 0.003, PLAKSHA[1], *IXC) == "outbound"

    def test_default_meeting_point(self):
        assert default_meeting_point("Plaksha University", *PLAKSHA) == "Plaksha main gate"
        assert default_meeting_point("IXC Airport", *IXC) == "Arrivals exit"
        assert default_meeting_point("Terminal drop-off", IXC[0] + 0.002, IXC[1]) == "Arrivals exit"
        assert default_meeting_point("Sector 70 Market", *SECTOR_70) == "Sector 70 Market"

    def test_match_message(self):
        msg = match_found_message("Avnet Singh", "IXC Airport", "Plaksha University", T0, 1, 0.35)
        assert msg == (
            "Avnet already has a 16:30 ride from IXC Airport to Plaksha University "
            "with 1 seat open, 350 m from your pickup. Join theirs instead?"
        )
        msg = match_found_message("Avnet Singh", "Sector 70 Market", "Elante Mall", T0, 3, 1.44)
        assert msg == (
            "Avnet already has a 16:30 ride from Sector 70 Market to Elante Mall "
            "with 3 seats open, 1.4 km from your pickup. Join theirs instead?"
        )

    def test_reminders(self):
        pool = self._pool("Plaksha University", "IXC Airport", "Plaksha main gate")
        title, body = reminder_text(pool, 20, ["Kavish", "Riya"])
        assert title == "Leaving in 20m"
        assert body == (
            "Your 16:30 ride from Plaksha University to IXC Airport with Kavish, Riya "
            "leaves in 20m. Meet at Plaksha main gate"
        )
        title, body = reminder_text(self._pool("Sector 70 Market", "Elante Mall", "Sector 70 Market"), 5, [])
        assert title == "Leaving in 5m"
        assert body == "Your 16:30 ride from Sector 70 Market to Elante Mall leaves in 5m. Meet at Sector 70 Market"


class TestLinks:
    def test_split(self):
        assert split_fare(280, 4) == Decimal("70.00")
        assert split_fare(250, 3) == Decimal("83.33")

    def test_upi_link(self):
        link = upi_pay_link("avnet@okaxis", "Avnet Singh", Decimal("70.00"), "TravelTrack 17:00 IXC")
        u = urlparse(link)
        assert u.scheme == "upi" and u.netloc == "pay"
        q = parse_qs(u.query)
        assert q["pa"] == ["avnet@okaxis"]
        assert q["am"] == ["70.00"]
        assert q["cu"] == ["INR"]
        assert q["tn"] == ["TravelTrack 17:00 IXC"]
        assert "+" not in link  # spaces must be %20 for UPI apps
        assert "pa=avnet@okaxis&" in link

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("98765 43210", "919876543210"),
            ("+91-98765-43210", "919876543210"),
            ("098765 43210", "919876543210"),
            ("+1 415 555 0100", "14155550100"),
        ],
    )
    def test_phone(self, raw, expected):
        assert normalize_phone(raw) == expected

    def test_bad_phone(self):
        with pytest.raises(ValueError):
            normalize_phone("12345")

    def test_wa_link(self):
        assert wa_link("919876543210", "hi there") == "https://wa.me/919876543210?text=hi%20there"
