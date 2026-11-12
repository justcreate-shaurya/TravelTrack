from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

PLAKSHA = {"name": "Plaksha University", "lat": 30.6310, "lng": 76.7245}
IXC = {"name": "IXC Airport", "lat": 30.6735, "lng": 76.7885}
CDG = {"name": "Chandigarh Railway Station", "lat": 30.7026, "lng": 76.8220}
# Free places that are not near any preset.
SECTOR_70 = {"name": "Sector 70 Market", "lat": 30.7000, "lng": 76.7200}
ZIRAKPUR = {"name": "Zirakpur Bus Stand", "lat": 30.6425, "lng": 76.8173}

KM_LAT = 0.008993  # one kilometre north, in degrees of latitude


def north(place: dict, km: float, name: str | None = None) -> dict:
    return {"name": name or place["name"], "lat": place["lat"] + km * KM_LAT, "lng": place["lng"]}


def window(start_min: int, length: int = 30):
    base = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    s = base + timedelta(minutes=start_min)
    return s.isoformat(), (s + timedelta(minutes=length)).isoformat()


def ride(origin, destination, start_min=180, length=30, **extra):
    ws, we = window(start_min, length)
    return {"origin": origin, "destination": destination, "window_start": ws, "window_end": we, **extra}


def airport_pool(start_min=180, length=30, **extra):
    return ride(PLAKSHA, IXC, start_min, length, **extra)


def airport_pickup(start_min=180, length=30, **extra):
    """Inbound: someone landing at IXC wants a ride back to Plaksha."""
    return ride(IXC, PLAKSHA, start_min, length, **extra)


def test_domain_enforced(client):
    r = client.post("/auth/dev", json={"email": "someone@gmail.com"})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "WRONG_DOMAIN"


def test_onboarding_required(client):
    r = client.post("/auth/dev", json={"email": "new.kid@plaksha.edu.in"})
    headers = {"Authorization": f"Bearer {r.json()['token']}"}
    assert r.json()["user"]["onboarded"] is False
    r = client.post("/pools", json=airport_pool(), headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "ONBOARDING_REQUIRED"


def test_meta_has_match_radius(client):
    meta = client.get("/meta").json()
    assert meta["match_radius_km"] == 2.0
    assert meta["match_grace_minutes"] == 15


def test_full_flow(client, login):
    avnet = login("avnet.singh@plaksha.edu.in", "9811111111", upi="avnet@okaxis")
    kavish = login("kavish.m@plaksha.edu.in", "9822222222")
    c = login("c.rider@plaksha.edu.in", "9833333333")
    d = login("d.rider@plaksha.edu.in", "9844444444")
    e = login("e.rider@plaksha.edu.in", "9855555555")

    # Avnet posts a pool 3h from now.
    r = client.post("/pools", json=airport_pool(180, 30), headers=avnet)
    assert r.status_code == 201, r.text
    pool = r.json()
    pid = pool["id"]
    assert pool["seats_open"] == 3 and pool["seats_taken"] == 1
    assert pool["direction"] == "outbound" and pool["vehicle"] == "sedan"
    assert pool["vehicle_seats"] == 4 and pool["max_seats"] == 4
    assert pool["origin"] == PLAKSHA and pool["destination"] == IXC
    assert 7 <= pool["distance_km"] <= 8
    assert pool["meeting_point"] == "Plaksha main gate"
    assert pool["members"][0]["seats"] == 1
    for gone in ("luggage_load", "bags", "boot", "seat_cap", "locked_seats", "origin_hub"):
        assert gone not in pool
    assert "luggage_count" not in pool["members"][0]

    # Kavish tries an overlapping window that starts 10 min later: intercepted.
    r = client.post("/pools", json=airport_pool(190, 30), headers=kavish)
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["code"] == "MATCH_FOUND"
    assert detail["matches"][0]["pool"]["id"] == pid
    assert detail["matches"][0]["origin_distance_m"] == 0
    assert detail["message"].startswith("Avnet already has a ")
    assert detail["message"].endswith(
        " ride from Plaksha University to IXC Airport with 3 seats open, 0 m from your pickup. "
        "Join theirs instead?"
    )

    # Window outside grace (starts 46 min after Avnet's ends) is not a match.
    r = client.post("/pools/matches", json=airport_pool(256, 30), headers=kavish)
    assert r.json() == []

    # Join instead.
    r = client.post(f"/pools/{pid}/join", json={}, headers=kavish)
    assert r.status_code == 200, r.text
    joined = r.json()
    assert joined["seats_taken"] == 2
    assert joined["contact_url"].startswith("https://wa.me/919811111111")
    assert joined["member_contacts"] is not None

    # Non-members don't see phone numbers.
    r = client.get(f"/pools/{pid}", headers=c)
    assert r.json()["member_contacts"] is None and r.json()["contact_url"] is None

    r = client.post(f"/pools/{pid}/join", json={"seats": 1}, headers=c)
    assert r.json()["status"] == "open" and r.json()["seats_open"] == 1

    # Not full and > T-30, so booking is locked.
    r = client.post(f"/pools/{pid}/book", json={"total_fare": 280}, headers=avnet)
    assert r.json()["detail"]["code"] == "NOT_BOOKABLE_YET"

    r = client.post(f"/pools/{pid}/join", json={}, headers=d)
    assert r.status_code == 200 and r.json()["status"] == "full" and r.json()["can_book"] is True

    r = client.post(f"/pools/{pid}/join", json={}, headers=e)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "POOL_FULL"

    # Creator upgrades to a 6-seat SUV, which reopens seats.
    r = client.patch(f"/pools/{pid}", json={"vehicle": "suv", "max_seats": 6}, headers=avnet)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "open" and r.json()["seats_open"] == 2
    assert r.json()["vehicle_seats"] == 6

    # Back to 4 seats in the SUV so the pool is full and bookable.
    r = client.patch(f"/pools/{pid}", json={"max_seats": 4}, headers=avnet)
    assert r.json()["status"] == "full" and r.json()["can_book"] is True

    # Kavish has no UPI ID, so can't be the booker.
    r = client.post(f"/pools/{pid}/book", json={"total_fare": 280}, headers=kavish)
    assert r.json()["detail"]["code"] == "UPI_REQUIRED"

    r = client.post(f"/pools/{pid}/book", json={"total_fare": 280, "booked_via": "uber"}, headers=avnet)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "booked"

    r = client.get(f"/pools/{pid}/settlement", headers=kavish)
    s = r.json()
    assert s["per_seat"] == "70" and s["seats"] == 4 and len(s["lines"]) == 3
    assert all(line["seats"] == 1 and line["amount"] == "70" for line in s["lines"])
    q = parse_qs(urlparse(s["lines"][0]["upi_link"]).query)
    assert q["am"] == ["70.00"] and q["pa"] == ["avnet@okaxis"]

    # Kavish marks paid.
    kavish_id = client.get("/me", headers=kavish).json()["id"]
    r = client.post(f"/pools/{pid}/members/{kavish_id}/paid", json={"has_paid": True}, headers=kavish)
    assert any(line["has_paid"] for line in r.json()["lines"])

    # Can't leave a booked pool.
    r = client.post(f"/pools/{pid}/leave", headers=kavish)
    assert r.json()["detail"]["code"] == "POOL_BOOKED"

    # The booker can reopen it.
    r = client.post(f"/pools/{pid}/unbook", headers=avnet)
    assert r.status_code == 200 and r.json()["status"] == "full" and r.json()["total_fare"] is None


def test_creator_handover_and_delete(client, login):
    a = login("a.one@plaksha.edu.in", "9811111112")
    b = login("b.two@plaksha.edu.in", "9811111113")
    pid = client.post("/pools", json=airport_pool(120), headers=a).json()["id"]
    client.post(f"/pools/{pid}/join", json={}, headers=b)
    assert client.delete(f"/pools/{pid}", headers=a).json()["detail"]["code"] == "HAS_RIDERS"
    r = client.post(f"/pools/{pid}/leave", headers=a)
    assert r.json()["deleted"] is False
    assert r.json()["pool"]["creator"]["name"] == "B Two"
    r = client.post(f"/pools/{pid}/leave", headers=b)
    assert r.json()["deleted"] is True
    assert client.get(f"/pools/{pid}", headers=b).status_code == 404

    pid = client.post("/pools", json=airport_pool(120), headers=a).json()["id"]
    assert client.delete(f"/pools/{pid}", headers=a).status_code == 204


def test_force_create_and_validation(client, login):
    a = login("a.one@plaksha.edu.in")
    b = login("b.two@plaksha.edu.in", "9811111119")
    client.post("/pools", json=airport_pool(120), headers=a)
    r = client.post("/pools", json=airport_pool(125, force=True), headers=b)
    assert r.status_code == 201
    assert len(client.get("/pools", headers=a).json()) == 2

    bad = airport_pool(120)
    bad["window_end"] = bad["window_start"]
    assert client.post("/pools", json=bad, headers=a).status_code == 422
    assert client.post("/pools", json=airport_pool(120, max_seats=6), headers=a).status_code == 422
    r = client.post("/pools", json=airport_pool(120, transit_mode="train", force=True), headers=a)
    assert r.status_code == 422
    # Too wide, already over, too far ahead.
    assert client.post("/pools", json=airport_pool(120, 400, force=True), headers=a).status_code == 422
    assert client.post("/pools", json=airport_pool(-120, 30, force=True), headers=a).status_code == 422
    far = airport_pool(60 * 24 * 31, 30, force=True)
    assert client.post("/pools", json=far, headers=a).status_code == 422
    # Places need a real name and real coordinates.
    for origin in ({"name": " x ", "lat": 30.7, "lng": 76.7}, {"name": "Nowhere", "lat": 91, "lng": 76.7}):
        assert client.post("/pools", json=ride(origin, IXC, force=True), headers=a).status_code == 422
    # Old hub-style bodies are gone.
    ws, we = window(120)
    old = {"origin_hub": "CAMPUS", "destination_hub": "IXC", "window_start": ws, "window_end": we}
    assert client.post("/pools", json=old, headers=a).status_code == 422


def test_archive_job(client, login):
    from app.scheduler import archive_job

    a = login("a.one@plaksha.edu.in")
    client.post("/pools", json=airport_pool(60), headers=a)
    assert archive_job(datetime.now(timezone.utc) + timedelta(hours=3)) == 1
    assert client.get("/pools", headers=a).json() == []


def test_websocket_receives_updates(client, login):
    a = login("a.one@plaksha.edu.in")
    token = a["Authorization"].split()[1]
    with client.websocket_connect(f"/ws?token={token}") as ws:
        client.post("/pools", json=airport_pool(60), headers=a)
        msg = ws.receive_json()
        assert msg["type"] == "pool.upsert"
        assert msg["pool"]["contact_url"] is None
        assert msg["pool"]["origin"]["name"] == "Plaksha University"


def test_inbound_pickup_and_match(client, login):
    a = login("avnet.singh@plaksha.edu.in", "9811111111")
    b = login("kavish.m@plaksha.edu.in", "9822222222")

    body = airport_pickup(300, 30, transit_mode="flight", transit_code="6e 2134")
    r = client.post("/pools", json=body, headers=a)
    assert r.status_code == 201, r.text
    pool = r.json()
    assert pool["direction"] == "inbound"
    assert pool["meeting_point"] == "Arrivals exit"
    assert pool["transit_code"] == "6E 2134"
    assert (pool["origin"]["name"], pool["destination"]["name"]) == ("IXC Airport", "Plaksha University")

    # Someone else at the airport around the same time is pointed at the existing ride.
    r = client.post("/pools", json=airport_pickup(310, 30), headers=b)
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["code"] == "MATCH_FOUND"
    assert detail["matches"][0]["pool"]["id"] == pool["id"]
    assert "ride from IXC Airport to Plaksha University with 3 seats open" in detail["message"]

    # The opposite direction at the same time is not a match.
    r = client.post("/pools/matches", json=airport_pool(310, 30), headers=b)
    assert r.json() == []

    # An explicit meeting point wins over the default; a blank one falls back to it.
    r = client.post("/pools", json=airport_pickup(310, 30, meeting_point="Gate 2", force=True), headers=b)
    assert r.json()["meeting_point"] == "Gate 2"
    r = client.post("/pools", json=airport_pickup(320, 30, meeting_point="  ", force=True), headers=b)
    assert r.json()["meeting_point"] == "Arrivals exit"


def test_free_place_to_free_place(client, login):
    a = login("a.one@plaksha.edu.in")
    body = ride({**SECTOR_70, "name": "  Sector 70   Market "}, ZIRAKPUR, 120)
    r = client.post("/pools", json=body, headers=a)
    assert r.status_code == 201, r.text
    pool = r.json()
    assert pool["direction"] == "other"
    assert pool["origin"] == SECTOR_70 and pool["destination"] == ZIRAKPUR
    # No preset nearby, so riders meet at the pickup itself.
    assert pool["meeting_point"] == "Sector 70 Market"
    assert pool["distance_km"] > 5
    listed = client.get("/pools", headers=a).json()
    assert [p["id"] for p in listed] == [pool["id"]]

    # Neither end has to be Plaksha: station to airport works too, with the preset's pickup spot.
    r = client.post("/pools", json=ride(north(CDG, 0.2, "Platform 1 side"), IXC, 200), headers=a)
    assert r.status_code == 201, r.text
    assert r.json()["direction"] == "other"
    assert r.json()["meeting_point"] == "Station main entrance"


def test_same_place_rejected(client, login):
    a = login("a.one@plaksha.edu.in")
    r = client.post("/pools", json=ride(PLAKSHA, north(PLAKSHA, 0.2, "Plaksha back gate"), 120), headers=a)
    assert r.status_code == 422
    assert "Pickup and drop are the same place" in r.text
    r = client.post("/pools", json=ride(SECTOR_70, SECTOR_70, 120), headers=a)
    assert r.status_code == 422
    # 400 m apart is a (short) trip.
    r = client.post("/pools", json=ride(SECTOR_70, north(SECTOR_70, 0.4, "Sector 70 Park"), 120), headers=a)
    assert r.status_code == 201, r.text


def test_radius_match(client, login):
    a = login("avnet.singh@plaksha.edu.in", "9811111111")
    b = login("kavish.m@plaksha.edu.in", "9822222222")
    pid = client.post("/pools", json=ride(SECTOR_70, ZIRAKPUR, 180), headers=a).json()["id"]

    # Pickup 1.5 km away, drop 1 km away, overlapping window: prompted to join.
    near = ride(north(SECTOR_70, 1.5, "Sector 71 Gurudwara"), north(ZIRAKPUR, 1.0, "Zirakpur Crossing"), 190)
    r = client.post("/pools", json=near, headers=b)
    assert r.status_code == 409, r.text
    detail = r.json()["detail"]
    assert detail["code"] == "MATCH_FOUND"
    match = detail["matches"][0]
    assert match["pool"]["id"] == pid
    assert 1450 <= match["origin_distance_m"] <= 1550
    assert 950 <= match["destination_distance_m"] <= 1050
    assert match["overlap_minutes"] == 20 and match["start_delta_minutes"] == -10
    assert match["same_transit"] is False
    assert "ride from Sector 70 Market to Zirakpur Bus Stand with 3 seats open, 1.5 km from your pickup" in (
        detail["message"]
    )
    assert client.post("/pools/matches", json=near, headers=b).json()[0]["pool"]["id"] == pid

    # Pickup 3 km away: no match.
    far_pickup = ride(north(SECTOR_70, 3.0, "Sector 68"), ZIRAKPUR, 190)
    assert client.post("/pools/matches", json=far_pickup, headers=b).json() == []
    # Drop 3 km away: no match.
    far_drop = ride(SECTOR_70, north(ZIRAKPUR, 3.0, "Dhakoli"), 190)
    assert client.post("/pools/matches", json=far_drop, headers=b).json() == []
    # Near enough, but outside the 15-minute grace: no match.
    late = ride(north(SECTOR_70, 1.5, "Sector 71 Gurudwara"), ZIRAKPUR, 256)
    assert client.post("/pools/matches", json=late, headers=b).json() == []
    # Inside the grace (starts 14 min after the other window ends) still matches.
    grace = ride(north(SECTOR_70, 1.5, "Sector 71 Gurudwara"), ZIRAKPUR, 224)
    assert len(client.post("/pools/matches", json=grace, headers=b).json()) == 1

    # A group that does not fit is not offered the ride; the creator never matches their own.
    assert client.post("/pools/matches", json={**near, "seats": 4}, headers=b).json() == []
    assert client.post("/pools/matches", json=near, headers=a).json() == []

    # So a far-away ride is simply created.
    r = client.post("/pools", json=far_pickup, headers=b)
    assert r.status_code == 201, r.text


def test_match_ranking(client, login):
    a = login("a.one@plaksha.edu.in", "9811111112")
    b = login("b.two@plaksha.edu.in", "9811111113")
    c = login("c.three@plaksha.edu.in", "9811111114")
    d = login("d.four@plaksha.edu.in", "9811111115")
    flight = {"transit_mode": "flight", "transit_code": "6E 2134"}
    same_time_far = client.post("/pools", json=ride(north(IXC, 1.2, "Airport Road"), PLAKSHA, 300), headers=a).json()
    same_time_near = client.post("/pools", json=airport_pickup(300, force=True), headers=b).json()
    same_flight = client.post("/pools", json=airport_pickup(320, force=True, **flight), headers=c).json()

    r = client.post("/pools/matches", json=airport_pickup(300, transit_code="6e 2134"), headers=d)
    assert [m["pool"]["id"] for m in r.json()] == [same_flight["id"], same_time_near["id"], same_time_far["id"]]
    assert r.json()[0]["same_transit"] is True


def test_seat_validation_on_create(client, login):
    a = login("a.one@plaksha.edu.in")

    def post(**extra):
        return client.post("/pools", json=airport_pool(120, force=True, **extra), headers=a)

    # Must give away at least one seat.
    assert post(max_seats=3, my_seats=3).status_code == 422
    assert post(max_seats=3, my_seats=4).status_code == 422
    # A cab has 4 passenger seats, an SUV 6, an auto 3.
    assert post(max_seats=5).status_code == 422
    assert post(vehicle="suv", max_seats=7).status_code == 422
    assert post(vehicle="auto", max_seats=4).status_code == 422
    assert post(vehicle="cab").status_code == 422
    assert post(vehicle="hatchback").status_code == 422

    r = post(vehicle="muv", max_seats=7, my_seats=3)
    assert r.status_code == 201, r.text
    p = r.json()
    assert (p["max_seats"], p["seats_taken"], p["seats_open"], p["vehicle_seats"]) == (7, 3, 4, 7)
    assert p["members"][0]["seats"] == 3


def test_auto_seats_three(client, login):
    a = login("a.one@plaksha.edu.in", "9811111112")
    b = login("b.two@plaksha.edu.in", "9811111113")
    c = login("c.three@plaksha.edu.in", "9811111114")
    r = client.post("/pools", json=airport_pool(120, vehicle="auto"), headers=a)
    assert r.status_code == 201, r.text
    p = r.json()
    assert (p["vehicle"], p["vehicle_seats"], p["max_seats"], p["seats_open"]) == ("auto", 3, 3, 2)
    r = client.post(f"/pools/{p['id']}/join", json={"seats": 3}, headers=b)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_ENOUGH_SEATS"
    r = client.post(f"/pools/{p['id']}/join", json={"seats": 2}, headers=b)
    assert r.status_code == 200 and r.json()["status"] == "full"
    r = client.post(f"/pools/{p['id']}/join", json={}, headers=c)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "POOL_FULL"
    # An auto can never be asked to take four.
    r = client.patch(f"/pools/{p['id']}", json={"max_seats": 4}, headers=a)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "TOO_MANY_SEATS"


def test_party_join_and_seat_changes(client, login):
    a = login("a.one@plaksha.edu.in", "9811111112")
    b = login("b.two@plaksha.edu.in", "9811111113")
    c = login("c.three@plaksha.edu.in", "9811111114")
    pid = client.post("/pools", json=airport_pool(120), headers=a).json()["id"]

    # B brings a friend: two seats.
    r = client.post(f"/pools/{pid}/join", json={"seats": 2}, headers=b)
    assert r.status_code == 200, r.text
    assert r.json()["seats_taken"] == 3 and r.json()["seats_open"] == 1
    assert [m["seats"] for m in r.json()["members"]] == [1, 2]
    assert client.post(f"/pools/{pid}/join", json={}, headers=b).json()["detail"]["code"] == "ALREADY_MEMBER"

    # C wants two seats, only one left.
    r = client.post(f"/pools/{pid}/join", json={"seats": 2}, headers=c)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_ENOUGH_SEATS"
    assert client.post(f"/pools/{pid}/join", json={"seats": 0}, headers=c).status_code == 422
    assert client.post(f"/pools/{pid}/join", json={"seats": 7}, headers=c).status_code == 422

    # B can't grow their group past the pool either.
    r = client.patch(f"/pools/{pid}/me", json={"seats": 4}, headers=b)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_ENOUGH_SEATS"
    r = client.patch(f"/pools/{pid}/me", json={"seats": 3}, headers=b)
    assert r.status_code == 200 and r.json()["status"] == "full"
    r = client.patch(f"/pools/{pid}/me", json={"seats": 2}, headers=b)
    assert r.json()["status"] == "open" and r.json()["seats_open"] == 1
    assert client.patch(f"/pools/{pid}/me", json={"seats": 1}, headers=c).json()["detail"]["code"] == "NOT_MEMBER"

    # Creator can't shrink below the seats riders hold, or past the car.
    r = client.patch(f"/pools/{pid}", json={"max_seats": 2}, headers=a)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_ENOUGH_SEATS"
    r = client.patch(f"/pools/{pid}", json={"max_seats": 5}, headers=a)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "TOO_MANY_SEATS"
    r = client.patch(f"/pools/{pid}", json={"max_seats": 3}, headers=a)
    assert r.status_code == 200 and r.json()["status"] == "full"
    assert client.patch(f"/pools/{pid}", json={"max_seats": 4}, headers=b).json()["detail"]["code"] == "NOT_CREATOR"

    # Switching to an SUV without a seat count keeps the current 3; with one, it opens up.
    r = client.patch(f"/pools/{pid}", json={"vehicle": "suv"}, headers=a)
    assert r.json()["max_seats"] == 3 and r.json()["status"] == "full"
    r = client.patch(f"/pools/{pid}", json={"vehicle": "suv", "max_seats": 6}, headers=a)
    assert r.json()["seats_open"] == 3 and r.json()["status"] == "open"
    r = client.post(f"/pools/{pid}/join", json={"seats": 2}, headers=c)
    assert r.status_code == 200 and r.json()["seats_taken"] == 5

    # Downgrading to a cab (4) or an auto (3) now would strand riders.
    for smaller in ("sedan", "auto"):
        r = client.patch(f"/pools/{pid}", json={"vehicle": smaller}, headers=a)
        assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_ENOUGH_SEATS"
    # A MUV without a seat count keeps the 6 already asked for.
    r = client.patch(f"/pools/{pid}", json={"vehicle": "muv"}, headers=a)
    assert (r.json()["max_seats"], r.json()["vehicle_seats"], r.json()["seats_open"]) == (6, 7, 1)


def test_settlement_per_seat(client, login):
    a = login("a.one@plaksha.edu.in", "9811111112", upi="aone@okaxis")
    b = login("b.two@plaksha.edu.in", "9811111113")
    c = login("c.three@plaksha.edu.in", "9811111114")
    dest = {"name": "Chandigarh Railway Station Platform One Side", "lat": CDG["lat"], "lng": CDG["lng"]}
    pid = client.post("/pools", json=ride(PLAKSHA, dest, 120), headers=a).json()["id"]
    assert client.get(f"/pools/{pid}/settlement", headers=a).json()["detail"]["code"] == "NOT_BOOKED"
    client.post(f"/pools/{pid}/join", json={"seats": 2}, headers=b)
    r = client.post(f"/pools/{pid}/join", json={}, headers=c)
    assert r.json()["status"] == "full"

    r = client.post(f"/pools/{pid}/book", json={"total_fare": 280}, headers=a)
    assert r.status_code == 200, r.text
    s = client.get(f"/pools/{pid}/settlement", headers=b).json()
    assert (s["total_fare"], s["seats"], s["per_seat"]) == (280, 4, "70")
    by_name = {line["user"]["name"]: line for line in s["lines"]}
    assert by_name["B Two"]["seats"] == 2 and by_name["B Two"]["amount"] == "140"
    assert by_name["C Three"]["seats"] == 1 and by_name["C Three"]["amount"] == "70"
    q = parse_qs(urlparse(by_name["B Two"]["upi_link"]).query)
    assert q["am"] == ["140.00"] and q["pa"] == ["aone@okaxis"]
    # The note names the destination, cut to 24 characters.
    assert q["tn"][0].startswith("TravelTrack ")
    assert q["tn"][0].endswith(" Chandigarh Railway Stati")


def test_settlement_survives_archive(client, login):
    """A booked ride turns `departed` 30 min after its window; the split must still work."""
    from app.scheduler import archive_job

    a = login("a.one@plaksha.edu.in", "9811111112", upi="aone@okaxis")
    b = login("b.two@plaksha.edu.in", "9811111113")
    c = login("c.three@plaksha.edu.in", "9811111114")
    pid = client.post("/pools", json=ride(PLAKSHA, CDG, 120), headers=a).json()["id"]
    client.post(f"/pools/{pid}/join", json={"seats": 2}, headers=b)
    client.post(f"/pools/{pid}/join", json={}, headers=c)
    # An unbooked ride that departs has no split.
    other = client.post("/pools", json=ride(PLAKSHA, IXC, 120), headers=c).json()["id"]
    assert client.post(f"/pools/{pid}/book", json={"total_fare": 280}, headers=a).status_code == 200

    assert archive_job(datetime.now(timezone.utc) + timedelta(hours=4)) == 2
    detail = client.get(f"/pools/{pid}", headers=b).json()
    assert detail["status"] == "departed" and detail["total_fare"] == 280

    r = client.get(f"/pools/{pid}/settlement", headers=b)
    assert r.status_code == 200, r.text
    s = r.json()
    assert (s["total_fare"], s["seats"], s["per_seat"]) == (280, 4, "70")
    lines = {line["user"]["name"]: line for line in s["lines"]}
    assert lines["B Two"]["amount"] == "140" and lines["B Two"]["has_paid"] is False
    assert lines["B Two"]["upi_link"]

    # The rider marks themselves paid, the booker marks the other one.
    b_id, c_id = lines["B Two"]["user"]["id"], lines["C Three"]["user"]["id"]
    r = client.post(f"/pools/{pid}/members/{b_id}/paid", json={"has_paid": True}, headers=b)
    assert r.status_code == 200, r.text
    r = client.post(f"/pools/{pid}/members/{c_id}/paid", json={"has_paid": True}, headers=a)
    assert r.status_code == 200, r.text
    assert all(line["has_paid"] for line in r.json()["lines"])

    # Nobody can walk out of the split, and a departed ride cannot be reopened.
    assert client.post(f"/pools/{pid}/leave", headers=b).json()["detail"]["code"] == "POOL_BOOKED"
    assert client.post(f"/pools/{pid}/unbook", headers=a).status_code == 403
    # A ride that left without being booked still has nothing to settle.
    r = client.get(f"/pools/{other}/settlement", headers=c)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_BOOKED"


def test_update_blank_meeting_point_resets_to_default(client, login):
    a = login("a.one@plaksha.edu.in")
    wa = "https://chat.whatsapp.com/AbCdEfGhIjK"
    out = client.post("/pools", json=airport_pool(120, meeting_point="Hostel 1"), headers=a).json()
    inb = client.post("/pools", json=airport_pickup(300), headers=a).json()
    free = client.post("/pools", json=ride(SECTOR_70, ZIRAKPUR, 500, meeting_point="Gate 9"), headers=a).json()
    assert out["meeting_point"] == "Hostel 1"

    r = client.patch(f"/pools/{out['id']}", json={"meeting_point": "", "whatsapp_group_url": wa}, headers=a)
    assert r.status_code == 200, r.text
    assert r.json()["meeting_point"] == "Plaksha main gate"
    assert r.json()["whatsapp_group_url"] == wa

    client.patch(f"/pools/{inb['id']}", json={"meeting_point": "Gate 4"}, headers=a)
    r = client.patch(f"/pools/{inb['id']}", json={"meeting_point": None}, headers=a)
    assert r.status_code == 200 and r.json()["meeting_point"] == "Arrivals exit"
    r = client.patch(f"/pools/{inb['id']}", json={"meeting_point": "  Gate 4  "}, headers=a)
    assert r.json()["meeting_point"] == "Gate 4"
    # Too short (after trimming) is still rejected; omitting it leaves it alone.
    assert client.patch(f"/pools/{inb['id']}", json={"meeting_point": " x "}, headers=a).status_code == 422
    r = client.patch(f"/pools/{inb['id']}", json={"custom_route_note": "via Kharar"}, headers=a)
    assert r.json()["meeting_point"] == "Gate 4"

    # A free place falls back to its own name.
    r = client.patch(f"/pools/{free['id']}", json={"meeting_point": " "}, headers=a)
    assert r.json()["meeting_point"] == "Sector 70 Market"


def test_outdated_tables_are_retired(client):
    from sqlalchemy import inspect

    from app.db import Base, engine, retire_outdated_tables

    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE pools (id CHAR(32) PRIMARY KEY, origin_hub VARCHAR(6))")
        conn.exec_driver_sql("CREATE TABLE pool_members (pool_id CHAR(32), luggage_count INTEGER)")
    retire_outdated_tables()
    assert not inspect(engine).has_table("pools")
    Base.metadata.create_all(engine)
    cols = {c["name"] for c in inspect(engine).get_columns("pools")}
    assert {"origin_name", "origin_lat", "dest_lng"} <= cols and "origin_hub" not in cols
    retire_outdated_tables()  # a current schema is left alone
    assert inspect(engine).has_table("pools")
