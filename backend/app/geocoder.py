"""Place search and reverse lookup through a Photon (OpenStreetMap) geocoder.

Only place text and map coordinates the user typed or pinned go to the geocoder. Results are
cached in-process for a short while so repeated keystrokes don't hammer the public instance.
"""

import logging
import time

import httpx

from .config import get_settings
from .errors import fail
from .geo import PRESETS, haversine_km, nearest_preset

log = logging.getLogger(__name__)
# httpx logs every request URL at INFO; keep what people search for out of the server log.
logging.getLogger("httpx").setLevel(logging.WARNING)

TIMEOUT_SECONDS = 4.0
CACHE_TTL_SECONDS = 600
CACHE_MAX_ENTRIES = 512
# Bias results towards the Chandigarh tricity.
BIAS_LAT, BIAS_LNG = 30.70, 76.76
PINNED_NAME = "Pinned location"

_cache: dict[tuple, tuple[float, object]] = {}


def clear_cache() -> None:
    _cache.clear()


def _cache_get(key: tuple):
    hit = _cache.get(key)
    if hit is None:
        return None
    expires, value = hit
    if expires < time.monotonic():
        _cache.pop(key, None)
        return None
    return value


def _cache_put(key: tuple, value) -> None:
    if len(_cache) >= CACHE_MAX_ENTRIES:
        now = time.monotonic()
        for k in [k for k, (exp, _) in _cache.items() if exp < now]:
            _cache.pop(k, None)
        while len(_cache) >= CACHE_MAX_ENTRIES:
            _cache.pop(next(iter(_cache)))
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)


def http_get(url: str, params: dict) -> dict:
    """The one network call in this module. Tests replace it."""
    r = httpx.get(
        url,
        params=params,
        timeout=TIMEOUT_SECONDS,
        headers={"User-Agent": "TravelTrack/1.0"},
    )
    r.raise_for_status()
    return r.json()


def _features(path: str, params: dict) -> list[dict]:
    url = get_settings().geocoder_url.rstrip("/") + path
    try:
        data = http_get(url, params)
        features = data.get("features") if isinstance(data, dict) else None
        if not isinstance(features, list):
            raise ValueError("unexpected geocoder response")
        return features
    except Exception as exc:  # network error, timeout, bad status, bad JSON
        log.warning("geocoder call failed: %s", exc)
        fail(502, "GEOCODER_DOWN", "Place search is unavailable right now")


def _text(props: dict, key: str) -> str:
    v = props.get(key)
    return v.strip() if isinstance(v, str) else ""


def _place_from_feature(feature: dict) -> dict | None:
    """Turn one Photon GeoJSON feature into {name, detail, lat, lng}, or None if unusable."""
    if not isinstance(feature, dict):
        return None
    props = feature.get("properties") or {}
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    try:
        lng, lat = float(coords[0]), float(coords[1])
    except (IndexError, TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None

    name = _text(props, "name")
    if not name and _text(props, "housenumber") and _text(props, "street"):
        name = f"{_text(props, 'housenumber')} {_text(props, 'street')}"
    if not name:
        name = next((_text(props, k) for k in ("street", "district", "city") if _text(props, k)), "")
    name = name[:80].strip()
    if len(name) < 2:
        return None

    parts: list[str] = []
    for key in ("district", "city", "state"):
        v = _text(props, key)
        if v and v.casefold() != name.casefold() and v.casefold() not in (p.casefold() for p in parts):
            parts.append(v)
    return {"name": name, "detail": ", ".join(parts), "lat": lat, "lng": lng}


def _preset_place(preset: dict) -> dict:
    return {"name": preset["name"], "detail": "", "lat": preset["lat"], "lng": preset["lng"]}


def _is_duplicate(place: dict, seen: list[dict]) -> bool:
    for other in seen:
        km = haversine_km(place["lat"], place["lng"], other["lat"], other["lng"])
        if km < 0.05:
            return True
        if km < 0.6 and place["name"].casefold() == other["name"].casefold():
            return True
    return False


def search_places(q: str, limit: int = 6) -> list[dict]:
    q = " ".join(q.split())
    if len(q) < 2:
        return []
    needle = q.casefold()
    out = [
        _preset_place(p)
        for p in PRESETS
        if needle in p["name"].casefold() or needle in p["short"].casefold()
    ]

    key = ("search", needle, limit)
    found = _cache_get(key)
    if found is None:
        features = _features(
            "/api", {"q": q, "limit": limit, "lang": "en", "lat": BIAS_LAT, "lon": BIAS_LNG}
        )
        found = [p for p in (_place_from_feature(f) for f in features) if p]
        _cache_put(key, found)

    for place in found:
        if not _is_duplicate(place, out):
            out.append(dict(place))
    return out[:limit]


def reverse_place(lat: float, lng: float) -> dict:
    preset = nearest_preset(lat, lng)
    if preset:
        return _preset_place(preset)

    key = ("reverse", round(lat, 4), round(lng, 4))
    found = _cache_get(key)
    if found is None:
        features = _features("/reverse", {"lat": lat, "lon": lng, "lang": "en"})
        found = next((p for p in (_place_from_feature(f) for f in features) if p), None)
        found = found or {"name": PINNED_NAME, "detail": ""}
        _cache_put(key, found)
    # Keep the point the user actually pinned; the geocoder only supplies the label.
    return {"name": found["name"], "detail": found["detail"], "lat": lat, "lng": lng}
