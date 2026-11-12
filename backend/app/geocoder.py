"""Place search and reverse lookup.

Provider: Geoapify (https://www.geoapify.com) when GEOAPIFY_API_KEY is set, otherwise the public
Photon instance at GEOCODER_URL. Both are OpenStreetMap data.

Only place text and map coordinates the user typed or pinned go to the geocoder. Results are
cached in-process for a short while so repeated keystrokes don't use up the free quota. The
built-in places (geo.PRESETS) never depend on the geocoder: a search that matches one still
answers when the geocoder is down.
"""

import logging
import time

import httpx

from .config import get_settings
from .errors import fail
from .geo import PRESETS, haversine_km, nearest_preset

log = logging.getLogger(__name__)
# httpx logs every request URL at INFO. Those URLs carry what people search for and, with
# Geoapify, the API key, so keep them out of the server log.
logging.getLogger("httpx").setLevel(logging.WARNING)

TIMEOUT_SECONDS = 4.0
CACHE_TTL_SECONDS = 600
CACHE_MAX_ENTRIES = 512
# Bias results towards the Chandigarh tricity.
BIAS_LAT, BIAS_LNG = 30.70, 76.76
PINNED_NAME = "Pinned location"
GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode"

_cache: dict[tuple, tuple[float, object]] = {}


class GeocoderDown(Exception):
    """The geocoder could not be reached or answered with something unusable."""


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


def _call(url: str, params: dict, list_key: str) -> list:
    try:
        data = http_get(url, params)
        items = data.get(list_key) if isinstance(data, dict) else None
        if not isinstance(items, list):
            raise ValueError("unexpected geocoder response")
        return items
    except Exception as exc:  # network error, timeout, bad status, bad JSON
        # Log the kind of failure only: the request URL would expose the API key and the query.
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        log.warning("geocoder call failed: %s%s", type(exc).__name__, f" (HTTP {status})" if status else "")
        raise GeocoderDown from None


def _geoapify_key() -> str:
    return get_settings().geoapify_api_key.strip()


# ---------------------------------------------------------------- turning results into places


def _text(props: dict, key: str) -> str:
    v = props.get(key)
    return v.strip() if isinstance(v, str) else ""


def _place(name: str, props: dict, lat, lng, detail_keys: tuple[str, ...]) -> dict | None:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    name = name[:80].strip()
    if len(name) < 2:
        return None
    parts: list[str] = []
    for key in detail_keys:
        v = _text(props, key)
        if v and v.casefold() != name.casefold() and v.casefold() not in (p.casefold() for p in parts):
            parts.append(v)
    return {"name": name, "detail": ", ".join(parts), "lat": lat, "lng": lng}


def _place_from_photon(feature: dict) -> dict | None:
    """One Photon GeoJSON feature -> {name, detail, lat, lng}, or None if unusable."""
    if not isinstance(feature, dict):
        return None
    props = feature.get("properties") or {}
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    if len(coords) < 2:
        return None
    name = _text(props, "name")
    if not name and _text(props, "housenumber") and _text(props, "street"):
        name = f"{_text(props, 'housenumber')} {_text(props, 'street')}"
    if not name:
        name = next((_text(props, k) for k in ("street", "district", "city") if _text(props, k)), "")
    return _place(name, props, coords[1], coords[0], ("district", "city", "state"))


def _place_from_geoapify(result: dict) -> dict | None:
    """One Geoapify result (format=json) -> {name, detail, lat, lng}, or None if unusable."""
    if not isinstance(result, dict):
        return None
    name = _text(result, "name") or _text(result, "address_line1")
    if not name:
        name = next((_text(result, k) for k in ("street", "suburb", "district", "city") if _text(result, k)), "")
    return _place(name, result, result.get("lat"), result.get("lon"), ("suburb", "district", "city", "state"))


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


# ---------------------------------------------------------------- providers


def _search_remote(q: str, limit: int) -> list[dict]:
    key = _geoapify_key()
    if key:
        results = _call(
            f"{GEOAPIFY_URL}/autocomplete",
            {
                "text": q,
                "limit": limit,
                "lang": "en",
                "filter": "countrycode:in",
                "bias": f"proximity:{BIAS_LNG},{BIAS_LAT}",
                "format": "json",
                "apiKey": key,
            },
            "results",
        )
        return [p for p in (_place_from_geoapify(r) for r in results) if p]
    url = get_settings().geocoder_url.rstrip("/") + "/api"
    features = _call(url, {"q": q, "limit": limit, "lang": "en", "lat": BIAS_LAT, "lon": BIAS_LNG}, "features")
    return [p for p in (_place_from_photon(f) for f in features) if p]


def _reverse_remote(lat: float, lng: float) -> dict | None:
    key = _geoapify_key()
    if key:
        results = _call(
            f"{GEOAPIFY_URL}/reverse",
            {"lat": lat, "lon": lng, "lang": "en", "format": "json", "apiKey": key},
            "results",
        )
        return next((p for p in (_place_from_geoapify(r) for r in results) if p), None)
    url = get_settings().geocoder_url.rstrip("/") + "/reverse"
    features = _call(url, {"lat": lat, "lon": lng, "lang": "en"}, "features")
    return next((p for p in (_place_from_photon(f) for f in features) if p), None)


# ---------------------------------------------------------------- public API


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

    key = ("search", "geoapify" if _geoapify_key() else "photon", needle, limit)
    found = _cache_get(key)
    if found is None:
        try:
            found = _search_remote(q, limit)
        except GeocoderDown:
            if out:  # the built-in places still answer; don't cache, so the next keystroke retries
                return out[:limit]
            fail(502, "GEOCODER_DOWN", "Place search is unavailable right now")
        _cache_put(key, found)

    for place in found:
        if not _is_duplicate(place, out):
            out.append(dict(place))
    return out[:limit]


def reverse_place(lat: float, lng: float) -> dict:
    preset = nearest_preset(lat, lng)
    if preset:
        return _preset_place(preset)

    key = ("reverse", "geoapify" if _geoapify_key() else "photon", round(lat, 4), round(lng, 4))
    found = _cache_get(key)
    if found is None:
        try:
            found = _reverse_remote(lat, lng)
        except GeocoderDown:
            fail(502, "GEOCODER_DOWN", "Place search is unavailable right now")
        found = found or {"name": PINNED_NAME, "detail": ""}
        _cache_put(key, found)
    # Keep the point the user actually pinned; the geocoder only supplies the label.
    return {"name": found["name"], "detail": found["detail"], "lat": lat, "lng": lng}
