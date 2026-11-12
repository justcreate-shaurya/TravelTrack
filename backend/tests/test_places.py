import httpx
import pytest

from app import geocoder


def feature(lng, lat, **props):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lng, lat]}, "properties": props}


@pytest.fixture()
def photon(monkeypatch):
    """Fake Photon: records every call and answers from `responses` keyed by URL path."""
    calls: list[tuple[str, dict]] = []
    responses: dict[str, object] = {}

    def fake(url, params):
        calls.append((url, dict(params)))
        path = "/" + url.rsplit("/", 1)[1]
        answer = responses.get(path, {"features": []})
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(geocoder, "http_get", fake)
    return calls, responses


def test_places_need_auth(client):
    assert client.get("/places/presets").status_code == 401
    assert client.get("/places/search", params={"q": "elante"}).status_code == 401
    assert client.get("/places/reverse", params={"lat": 30.7, "lng": 76.7}).status_code == 401


def test_presets(client, login):
    a = login("a.one@plaksha.edu.in")
    presets = client.get("/places/presets", headers=a).json()
    assert [p["key"] for p in presets] == [
        "PLAKSHA", "IXC", "CDG", "SASN", "ISBT43", "SEC17", "ELANTE", "CP67", "SEC35"
    ]
    assert presets[0] == {
        "key": "PLAKSHA",
        "name": "Plaksha University",
        "short": "Plaksha",
        "code": "PLK",
        "lat": 30.6310,
        "lng": 76.7245,
        "pickup": "Plaksha main gate",
    }
    assert presets[1]["pickup"] == "Arrivals exit" and presets[1]["code"] == "IXC"


def test_search_merges_presets_and_photon(client, login, photon):
    calls, responses = photon
    a = login("a.one@plaksha.edu.in")
    responses["/api"] = {
        "features": [
            # The mall itself, a few metres from the preset: dropped as a duplicate.
            feature(76.8014, 30.7057, name="Elante Mall", city="Chandigarh", state="Chandigarh"),
            feature(76.8050, 30.7100, name="Elante Office Suites", district="Industrial Area Phase I",
                    city="Chandigarh", state="Chandigarh"),
            # No name: house number + street.
            feature(76.7300, 30.6900, housenumber="12", street="Elante Road", city="Mohali", state="Punjab"),
            # No name or house number: falls back to the street, and the detail skips the repeat.
            feature(76.7400, 30.6950, street="Elante Lane", district="Elante Lane", city="Mohali"),
            # The same result twice.
            feature(76.7400, 30.6950, street="Elante Lane", city="Mohali"),
            # Unusable: nothing to call it, or no coordinates.
            feature(76.7500, 30.6990, state="Punjab"),
            {"type": "Feature", "geometry": None, "properties": {"name": "Elante Ghost"}},
        ]
    }
    r = client.get("/places/search", params={"q": "elante"}, headers=a)
    assert r.status_code == 200, r.text
    assert r.json() == [
        {"name": "Elante Mall", "detail": "", "lat": 30.7056, "lng": 76.8013},
        {"name": "Elante Office Suites", "detail": "Industrial Area Phase I, Chandigarh",
         "lat": 30.71, "lng": 76.805},
        {"name": "12 Elante Road", "detail": "Mohali, Punjab", "lat": 30.69, "lng": 76.73},
        {"name": "Elante Lane", "detail": "Mohali", "lat": 30.695, "lng": 76.74},
    ]
    url, params = calls[0]
    assert url == "https://geocoder.test/api"
    assert params == {"q": "elante", "limit": 6, "lang": "en", "lat": 30.70, "lon": 76.76}

    # The same query again is served from the cache.
    client.get("/places/search", params={"q": "Elante "}, headers=a)
    assert len(calls) == 1

    # Presets match on the short name too, and `limit` caps the list.
    responses["/api"] = {"features": [feature(76.79, 30.68, name="Airport Chowk", city="Mohali")]}
    r = client.get("/places/search", params={"q": "airport", "limit": 1}, headers=a)
    assert [p["name"] for p in r.json()] == ["IXC Airport"]
    r = client.get("/places/search", params={"q": "airport", "limit": 5}, headers=a)
    assert [p["name"] for p in r.json()] == ["IXC Airport", "Airport Chowk"]

    assert client.get("/places/search", params={"q": "e"}, headers=a).status_code == 422
    assert client.get("/places/search", params={"q": "x" * 81}, headers=a).status_code == 422


def test_reverse_prefers_a_preset(client, login, photon):
    calls, responses = photon
    a = login("a.one@plaksha.edu.in")
    # ~300 m from the airport preset: no geocoder call at all.
    r = client.get("/places/reverse", params={"lat": 30.6760, "lng": 76.7890}, headers=a)
    assert r.status_code == 200, r.text
    assert r.json() == {"name": "IXC Airport", "detail": "", "lat": 30.6735, "lng": 76.7885}
    assert calls == []

    # Away from every preset the geocoder names the spot; the pinned point is kept.
    responses["/reverse"] = {
        "features": [feature(76.7201, 30.7002, name="Sector 70 Market", district="Sector 70",
                             city="Mohali", state="Punjab")]
    }
    r = client.get("/places/reverse", params={"lat": 30.7000, "lng": 76.7200}, headers=a)
    assert r.json() == {
        "name": "Sector 70 Market", "detail": "Sector 70, Mohali, Punjab", "lat": 30.7, "lng": 76.72
    }
    assert calls == [("https://geocoder.test/reverse", {"lat": 30.7, "lon": 76.72, "lang": "en"})]

    # Nothing there: a generic label.
    responses["/reverse"] = {"features": []}
    r = client.get("/places/reverse", params={"lat": 30.6000, "lng": 76.6000}, headers=a)
    assert r.json() == {"name": "Pinned location", "detail": "", "lat": 30.6, "lng": 76.6}

    assert client.get("/places/reverse", params={"lat": 95, "lng": 76.6}, headers=a).status_code == 422


@pytest.mark.parametrize(
    "failure",
    [httpx.ConnectTimeout("timed out"), httpx.ConnectError("no route"), ValueError("not json")],
)
def test_geocoder_failure_is_502(client, login, photon, failure):
    calls, responses = photon
    a = login("a.one@plaksha.edu.in")
    responses["/api"] = failure
    responses["/reverse"] = failure
    for path, params in (
        ("/places/search", {"q": "sector 70"}),
        ("/places/reverse", {"lat": 30.7000, "lng": 76.7200}),
    ):
        r = client.get(path, params=params, headers=a)
        assert r.status_code == 502
        assert r.json()["detail"] == {
            "code": "GEOCODER_DOWN",
            "message": "Place search is unavailable right now",
        }
    # Failures are not cached, and presets still work without the geocoder.
    responses["/api"] = {"features": []}
    assert client.get("/places/search", params={"q": "sector 70"}, headers=a).json() == []
    assert len(client.get("/places/presets", headers=a).json()) == 9
    assert client.get("/places/reverse", params={"lat": 30.6310, "lng": 76.7245}, headers=a).json()[
        "name"
    ] == "Plaksha University"


def test_geocoder_garbage_is_502(client, login, photon):
    calls, responses = photon
    a = login("a.one@plaksha.edu.in")
    responses["/api"] = {"message": "rate limited"}
    assert client.get("/places/search", params={"q": "sector 70"}, headers=a).status_code == 502


def test_real_http_call_shape(monkeypatch):
    """`http_get` itself: one GET with a 4 second timeout, raising on a bad status."""
    seen = {}

    class Resp:
        def raise_for_status(self):
            seen["checked"] = True

        def json(self):
            return {"features": []}

    def fake_get(url, **kwargs):
        seen.update(url=url, **kwargs)
        return Resp()

    monkeypatch.undo()  # drop the autouse block so the real http_get runs against the fake httpx
    monkeypatch.setattr(httpx, "get", fake_get)
    assert geocoder.http_get("https://geocoder.test/api", {"q": "x"}) == {"features": []}
    assert seen["timeout"] == 4.0 and seen["params"] == {"q": "x"} and seen["checked"]


# ---------------------------------------------------------------- Geoapify (GEOAPIFY_API_KEY set)


@pytest.fixture()
def geoapify(monkeypatch, photon):
    """Switch the provider to Geoapify for one test; reuses the fake transport."""
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "geoapify_api_key", "test-key")
    return photon


def test_geoapify_search(client, login, geoapify):
    calls, responses = geoapify
    a = login("a.one@plaksha.edu.in")
    responses["/autocomplete"] = {
        "results": [
            # Next to the Elante preset: dropped as a duplicate.
            {"name": "Elante Mall", "city": "Chandigarh", "state": "Chandigarh", "lat": 30.7057, "lon": 76.8014},
            {"name": "Elante Office Suites", "suburb": "Industrial Area Phase I", "city": "Chandigarh",
             "state": "Chandigarh", "lat": 30.71, "lon": 76.805},
            # No name: the first address line.
            {"address_line1": "12 Elante Road", "city": "Mohali", "state": "Punjab", "lat": 30.69, "lon": 76.73},
            {"name": "Nowhere", "lat": "not a number", "lon": 76.0},
        ]
    }
    r = client.get("/places/search", params={"q": "elante"}, headers=a)
    assert r.status_code == 200, r.text
    assert r.json() == [
        {"name": "Elante Mall", "detail": "", "lat": 30.7056, "lng": 76.8013},
        {"name": "Elante Office Suites", "detail": "Industrial Area Phase I, Chandigarh", "lat": 30.71, "lng": 76.805},
        {"name": "12 Elante Road", "detail": "Mohali, Punjab", "lat": 30.69, "lng": 76.73},
    ]
    url, params = calls[0]
    assert url == "https://api.geoapify.com/v1/geocode/autocomplete"
    assert params == {
        "text": "elante", "limit": 6, "lang": "en", "filter": "countrycode:in",
        "bias": "proximity:76.76,30.7", "format": "json", "apiKey": "test-key",
    }


def test_geoapify_reverse(client, login, geoapify):
    calls, responses = geoapify
    a = login("a.one@plaksha.edu.in")
    responses["/reverse"] = {
        "results": [{"name": "Sector 70 Market", "suburb": "Sector 70", "city": "Mohali", "state": "Punjab",
                     "lat": 30.7002, "lon": 76.7201}]
    }
    r = client.get("/places/reverse", params={"lat": 30.7, "lng": 76.72}, headers=a)
    assert r.json() == {"name": "Sector 70 Market", "detail": "Sector 70, Mohali, Punjab", "lat": 30.7, "lng": 76.72}
    assert calls[0][0] == "https://api.geoapify.com/v1/geocode/reverse"
    assert calls[0][1]["apiKey"] == "test-key"


def test_presets_still_answer_when_geocoder_is_down(client, login, geoapify):
    calls, responses = geoapify
    a = login("a.one@plaksha.edu.in")
    responses["/autocomplete"] = httpx.ConnectTimeout("timed out")
    r = client.get("/places/search", params={"q": "elante"}, headers=a)
    assert r.status_code == 200, r.text
    assert [p["name"] for p in r.json()] == ["Elante Mall"]
    # Not cached: once the geocoder is back, the same search reaches it.
    responses["/autocomplete"] = {"results": [{"name": "Elante Office Suites", "lat": 30.71, "lon": 76.805}]}
    r = client.get("/places/search", params={"q": "elante"}, headers=a)
    assert [p["name"] for p in r.json()] == ["Elante Mall", "Elante Office Suites"]
    # Nothing built in matches: the outage is reported.
    responses["/autocomplete"] = httpx.ConnectTimeout("timed out")
    assert client.get("/places/search", params={"q": "sector 70"}, headers=a).status_code == 502


def test_api_key_never_logged(client, login, geoapify, caplog):
    calls, responses = geoapify
    a = login("a.one@plaksha.edu.in")
    req = httpx.Request("GET", "https://api.geoapify.com/v1/geocode/autocomplete?text=x&apiKey=test-key")
    responses["/autocomplete"] = httpx.HTTPStatusError("401", request=req, response=httpx.Response(401, request=req))
    with caplog.at_level("WARNING"):
        assert client.get("/places/search", params={"q": "sector 70"}, headers=a).status_code == 502
    assert "geocoder call failed: HTTPStatusError (HTTP 401)" in caplog.text
    assert "test-key" not in caplog.text and "sector" not in caplog.text
