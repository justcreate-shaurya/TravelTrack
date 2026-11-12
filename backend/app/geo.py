"""Geography helpers: distances, the preset places and Plaksha detection. No DB or network here."""

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0088
PRESET_SNAP_KM = 0.6

PLAKSHA: tuple[float, float] = (30.6310, 76.7245)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in kilometres."""
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = p2 - p1, radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(min(1.0, sqrt(a)))


def is_plaksha(lat: float, lng: float) -> bool:
    return haversine_km(lat, lng, *PLAKSHA) <= PRESET_SNAP_KM


def _preset(key: str, name: str, short: str, code: str, lat: float, lng: float, pickup: str) -> dict:
    return {
        "key": key,
        "name": name,
        "short": short,
        "code": code,
        "lat": lat,
        "lng": lng,
        "pickup": pickup,
    }


# Single source of truth for the quick-pick places; served to the frontend by GET /places/presets.
# NOTE: these coordinates are approximate and should be checked on a map before launch.
PRESETS: list[dict] = [
    _preset("PLAKSHA", "Plaksha University", "Plaksha", "PLK", 30.6310, 76.7245, "Plaksha main gate"),
    _preset("IXC", "IXC Airport", "Airport", "IXC", 30.6735, 76.7885, "Arrivals exit"),
    _preset(
        "CDG", "Chandigarh Railway Station", "CDG Station", "CDG", 30.7026, 76.8220,
        "Station main entrance",
    ),
    _preset("SASN", "Mohali Railway Station", "Mohali Stn", "SASN", 30.6795, 76.7355, "Station entrance"),
    _preset("ISBT43", "ISBT Sector 43", "ISBT 43", "I43", 30.7215, 76.7495, "ISBT main entrance"),
    _preset("SEC17", "Sector 17 Plaza", "Sector 17", "S17", 30.7410, 76.7800, "Sector 17 Plaza"),
    _preset("ELANTE", "Elante Mall", "Elante", "ELT", 30.7056, 76.8013, "Elante main entrance"),
    _preset("CP67", "CP67 Mall", "CP67", "CP67", 30.6785, 76.7225, "CP67 main entrance"),
    _preset("SEC35", "Sector 35 Market", "Sector 35", "S35", 30.7240, 76.7640, "Sector 35 market"),
]


def nearest_preset(lat: float, lng: float, within_km: float = PRESET_SNAP_KM) -> dict | None:
    """The closest preset no further than `within_km` away, or None."""
    best, best_d = None, within_km
    for p in PRESETS:
        d = haversine_km(lat, lng, p["lat"], p["lng"])
        if d <= best_d:
            best, best_d = p, d
    return best


def bounding_box(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """(lat_min, lat_max, lng_min, lng_max) of a box safely larger than the radius circle.

    Used as a cheap SQL prefilter; the exact haversine check happens in Python afterwards.
    """
    pad = radius_km * 1.25 + 0.1
    dlat = pad / 110.5  # a degree of latitude is never shorter than about 110.5 km
    dlng = pad / (111.3 * max(0.05, cos(radians(min(89.0, abs(lat) + dlat)))))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def format_distance(km: float) -> str:
    """'350 m' below a kilometre, '1.4 km' from there up."""
    metres = round(km * 1000)
    if metres < 1000:
        return f"{metres} m"
    return f"{metres / 1000:.1f} km"
