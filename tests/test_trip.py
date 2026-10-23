"""
tests/test_trip.py — Real addresses, privacy, the server-derived trip state, settling up,
the geocoding proxy (cache, global queue, throttling), Google Maps links, join links and demo reset.
"""
import json
import time
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.clock import CLOCK, now
from backend.demo_data import reset_all
from backend.models import PassengerRequest, Group, Proposal
from backend import geo


@pytest.fixture(autouse=True)
def fresh_world():
    Base.metadata.create_all(bind=engine)
    CLOCK.reset()
    db = SessionLocal()
    reset_all(db, now())
    db.close()
    geo.reset_geo_state()
    yield


def client_for(session_id: str) -> TestClient:
    c = TestClient(app)
    c.headers.update({"X-Session-ID": session_id})
    return c


def new_request(c: TestClient, lat=12.9279, lng=77.5862, **extra):
    body = {
        "dest_lat": lat,
        "dest_lng": lng,
        "scheduled_arrival": now().isoformat(),
        **extra,
    }
    return c.post("/requests", json=body)


# -----------------------------------------------------------------------------
# Real coordinates and service range
# -----------------------------------------------------------------------------
def test_arbitrary_coordinate_request_matches():
    c = client_for("sess_arbitrary_coord")
    # A street corner in Jayanagar that is not any known area centroid, with no area or zone given
    r = new_request(c, lat=12.92713, lng=77.58771, accuracy="pin")
    assert r.status_code == 200, r.text
    assert r.json()["area"] == "Jayanagar"

    trip = c.get("/trip").json()
    assert trip["state"] == "options"
    assert trip["options"]["best_id"] is not None
    best = next(g for g in trip["options"]["groups"] if g["id"] == trip["options"]["best_id"])
    assert len(best["members"]) >= 2
    assert best["viewer_saving_inr"] > 0


def test_out_of_range_drop_is_refused_with_solo_link():
    c = client_for("sess_too_far_01")
    r = new_request(c, lat=12.3052, lng=76.6552)  # Mysuru, ~150 km away
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "out_of_range"
    assert detail["message"] == "That's too far for a shared cab from the airport. Try a closer drop point, or book alone."
    assert detail["solo_link"].startswith("https://m.uber.com/ul/")
    assert detail["distance_from_airport_km"] > 70
    assert c.get("/trip").json()["state"] == "start"


def test_only_where_and_when_are_required():
    c = client_for("sess_minimal_01")
    r = new_request(c)
    assert r.status_code == 200
    req = c.get("/trip").json()["request"]
    assert req["flight_no"] is None
    assert req["name_given"] is False


# -----------------------------------------------------------------------------
# Privacy
# -----------------------------------------------------------------------------
SECRET_A = "Flat 4B, Lakeview Residency, 11th Main Road"
DETAIL_A = "Blue gate opposite the bakery"
SECRET_B = "No. 27, 36th Cross, 9th Block"
DETAIL_B = "Ring bell twice"


def pair_up():
    """Two real (non-demo) travellers heading to Jayanagar who only match each other."""
    db = SessionLocal()
    reset_all(db, now(), scenario="stage")
    db.close()
    a = client_for("sess_privacy_aaaa")
    b = client_for("sess_privacy_bbbb")
    assert new_request(b, 12.9195, 77.5900, area="Jayanagar", accuracy="address",
                       exact_address=SECRET_B, drop_detail=DETAIL_B, first_name="Deepa").status_code == 200
    assert new_request(a, 12.9279, 77.5826, area="Jayanagar", accuracy="address",
                       exact_address=SECRET_A, drop_detail=DETAIL_A).status_code == 200
    trip_a = a.get("/trip").json()
    assert trip_a["state"] == "options"
    raw = json.dumps(trip_a)
    assert SECRET_B not in raw and DETAIL_B not in raw
    best = next(g for g in trip_a["options"]["groups"] if g["id"] == trip_a["options"]["best_id"])
    other = next(m for m in best["members"] if not m["is_you"])
    assert other["dest_label"] == "Jayanagar"
    assert other["approx_km_from_you"] > 0
    assert len(str(other["dest_lat"]).split(".")[-1]) <= 2
    return a, b, best


def all_responses_for(c: TestClient, group_id: str) -> str:
    me = c.get("/requests/me").json()
    return json.dumps([
        c.get("/trip").json(),
        c.get(f"/groups/{group_id}").json(),
        c.post(f"/groups/{group_id}/links").json(),
        c.get("/proposals/inbox").json(),
        c.get(f"/requests/{me['request']['id']}/options").json(),
    ])


def test_non_booker_never_receives_exact_address():
    a, b, best = pair_up()
    other_ids = [m["request_id"] for m in best["members"] if not m["is_you"]]
    r = a.post("/proposals", json={"member_request_ids": other_ids, "first_name": "Asha"})
    assert r.status_code == 200

    trip_b = b.get("/trip").json()
    assert trip_b["state"] == "invite_received"
    assert "Same area (Jayanagar)" in trip_b["invite"]["why"]
    assert SECRET_A not in json.dumps(trip_b) and DETAIL_A not in json.dumps(trip_b)

    assert b.post(f"/proposals/{r.json()['id']}/respond", json={"action": "accept"}).status_code == 200
    trip_a = a.get("/trip").json()
    assert trip_a["state"] == "confirmed"
    group_id = trip_a["group"]["id"]

    # The person booking (A, who sent the invite) gets every address line, including drop details
    assert trip_a["group"]["is_booker"] is True
    lines = " | ".join(s["address_line"] for s in trip_a["group"]["stops"])
    assert SECRET_B in lines and DETAIL_B in lines
    assert trip_a["group"]["uber_link"]
    assert SECRET_A not in trip_a["group"]["uber_link"] and SECRET_B not in trip_a["group"]["uber_link"]

    # B is not booking: no address lines anywhere, from any endpoint
    raw_b = all_responses_for(b, group_id)
    for secret in (SECRET_A, DETAIL_A):
        assert secret not in raw_b
    trip_b = b.get("/trip").json()
    assert all("address_line" not in s for s in trip_b["group"]["stops"])
    assert trip_b["group"]["uber_link"] is None

    # Someone outside the group can't read it at all
    stranger = client_for("sess_privacy_cccc")
    new_request(stranger)
    assert stranger.get(f"/groups/{group_id}").status_code == 403
    assert stranger.post(f"/groups/{group_id}/links").status_code == 403


def test_private_fields_are_deleted_with_the_trip():
    a, b, best = pair_up()
    other_ids = [m["request_id"] for m in best["members"] if not m["is_you"]]
    prop = a.post("/proposals", json={"member_request_ids": other_ids, "first_name": "Asha"}).json()
    b.post(f"/proposals/{prop['id']}/respond", json={"action": "accept"})
    group_id = a.get("/trip").json()["group"]["id"]
    a_id = a.get("/requests/me").json()["request"]["id"]
    a.post(f"/groups/{group_id}/cab", json={"cab_number": "ka 01 ab 1234"})
    a.post(f"/groups/{group_id}/settle", json={"final_fare": 1650, "upi_id": "asha@okaxis"})
    a.patch(f"/requests/{a_id}/status", json={"status": "done"})

    db = SessionLocal()
    for r in db.query(PassengerRequest).filter(PassengerRequest.is_demo == False).all():  # noqa: E712
        assert r.exact_address is None and r.drop_detail is None
    db.close()


# -----------------------------------------------------------------------------
# Trip state machine and settling up
# -----------------------------------------------------------------------------
def test_full_trip_state_progression_and_actual_fare_split():
    c = client_for("sess_progress_01")
    assert c.get("/trip").json()["state"] == "start"
    new_request(c, area="Jayanagar")
    trip = c.get("/trip").json()
    assert trip["state"] == "options"
    assert trip["live"]["landing_soon"] > 0

    best = next(g for g in trip["options"]["groups"] if g["id"] == trip["options"]["best_id"])
    others = [m["request_id"] for m in best["members"] if not m["is_you"]]
    assert c.post("/proposals", json={"member_request_ids": others, "first_name": "Asha"}).status_code == 200
    trip = c.get("/trip").json()
    assert trip["state"] == "invite_sent"
    assert {m["response"] for m in trip["proposal"]["members"] if not m["is_you"]} == {"pending"}

    trip = c.post("/demo/respond").json()
    assert trip["state"] == "confirmed"
    group = trip["group"]
    assert group["is_booker"] and len(group["pickup_code"]) == 4
    req_id = trip["request"]["id"]

    c.patch(f"/requests/{req_id}/status", json={"status": "landed"})
    assert c.get("/trip").json()["state"] == "landed"
    c.patch(f"/requests/{req_id}/status", json={"status": "at_pickup"})
    assert c.get("/trip").json()["state"] == "at_pickup"

    assert c.post(f"/groups/{group['id']}/cab", json={"cab_number": "ka01 ab"}).status_code == 422
    trip = c.post(f"/groups/{group['id']}/cab", json={"cab_number": "ka 01 ab 1234"}).json()
    assert trip["state"] == "cab_booked" and trip["group"]["cab_number"] == "KA 01 AB 1234"

    trip = c.post(f"/groups/{group['id']}/settle/start").json()
    assert trip["state"] == "settle" and trip["group"]["final_fare"] is None

    trip = c.post(f"/groups/{group['id']}/settle", json={"final_fare": 1999, "upi_id": "asha@okaxis"}).json()
    shares = {m["request_id"]: m["final_share"] for m in trip["group"]["members"]}
    assert sum(shares.values()) == 1999
    # Same method as the estimate: the actual shares keep the estimated proportions (to within a rupee)
    est_total = sum(m["fare_share_est"] for m in trip["group"]["members"])
    for m in trip["group"]["members"]:
        assert abs(m["final_share"] - 1999 * m["fare_share_est"] / est_total) <= 60
    assert all(v and v.startswith("upi://pay?pa=asha@okaxis") for v in trip["group"]["pay_links"].values())

    c.patch(f"/requests/{req_id}/status", json={"status": "done"})
    trip = c.get("/trip").json()
    assert trip["state"] == "done"
    assert c.post("/trip/new").json()["state"] == "start"


def test_invite_received_from_a_demo_traveller():
    c = client_for("sess_invited_01")
    new_request(c, area="Jayanagar")
    trip = c.post("/demo/invite-me").json()
    assert trip["state"] == "invite_received"
    assert trip["underlying_state"] == "options"
    assert trip["invite"]["why"]
    assert trip["invite"]["saving_inr"] > 0
    assert any(m["is_demo"] for m in trip["invite"]["members"])
    r = c.post(f"/proposals/{trip['invite']['id']}/respond", json={"action": "accept", "first_name": "Ravi"})
    assert r.status_code == 200 and r.json()["group_id"]
    trip = c.get("/trip").json()
    assert trip["state"] == "confirmed" and trip["group"]["is_booker"] is False


def test_no_match_state():
    c = client_for("sess_lonely_01")
    # Nandi Hills: inside the service radius, nobody else heading there
    new_request(c, lat=13.3702, lng=77.6835)
    assert c.get("/trip").json()["state"] == "no_match"


def test_refresh_resumes_the_same_state():
    c = client_for("sess_refresh_01")
    new_request(c, area="Jayanagar")
    first = c.get("/trip").json()
    again = client_for("sess_refresh_01").get("/trip").json()
    assert first["state"] == again["state"] == "options"
    assert first["request"]["id"] == again["request"]["id"]


# -----------------------------------------------------------------------------
# Geocoding proxy
# -----------------------------------------------------------------------------
def fake_photon(calls):
    def _get(url, params):
        calls.append((time.monotonic(), url, dict(params)))
        if url.endswith("/reverse"):
            return {"features": [{"geometry": {"coordinates": [params["lon"], params["lat"]]},
                                  "properties": {"name": "11th Main Road", "locality": "Jayanagar", "type": "street"}}]}
        return {"features": [{"geometry": {"coordinates": [77.5826, 12.9279]},
                              "properties": {"name": "Forum Mall", "street": "Hosur Road", "locality": "Koramangala",
                                             "city": "Bengaluru", "type": "house", "osm_type": "W", "osm_id": 1}}]}
    return _get


def test_search_proxy_is_cached_and_biased(monkeypatch):
    calls = []
    monkeypatch.setattr(geo, "http_get_json", fake_photon(calls))
    c = TestClient(app)
    first = c.get("/geo/search", params={"q": "Forum Mall"}).json()
    second = c.get("/geo/search", params={"q": "  forum   mall "}).json()
    assert len(calls) == 1
    assert first["cached"] is False and second["cached"] is True
    assert second["results"][0]["name"] == "Forum Mall"
    assert second["results"][0]["secondary"] == "Hosur Road, Koramangala, Bengaluru"
    params = calls[0][2]
    assert params["lat"] == 13.1986 and params["lon"] == 77.7066 and params["limit"] == 6
    assert "bbox" in params
    # The browser only ever sees our own result shape, never an upstream URL
    assert "komoot" not in json.dumps(first) and "photon.komoot" not in json.dumps(first)
    assert c.get("/geo/search", params={"q": "ab"}).status_code == 422


def test_search_proxy_global_queue_is_one_per_second(monkeypatch):
    calls = []
    monkeypatch.setattr(geo, "http_get_json", fake_photon(calls))
    c = TestClient(app)
    for q in ("place one", "place two", "place three"):
        c.get("/geo/search", params={"q": q})
    gaps = [b[0] - a[0] for a, b in zip(calls, calls[1:])]
    assert len(calls) == 3
    assert all(g >= 0.95 for g in gaps), gaps


def test_search_proxy_throttles_gracefully(monkeypatch):
    calls = []
    monkeypatch.setattr(geo, "http_get_json", fake_photon(calls))
    monkeypatch.setattr(geo.PHOTON_QUEUE, "max_wait", 0.0)
    c = TestClient(app)
    c.get("/geo/search", params={"q": "first query"})
    throttled = c.get("/geo/search", params={"q": "jayanagar"}).json()
    assert len(calls) == 1
    assert throttled["throttled"] is True
    assert "Try again in a moment" in throttled["message"]
    # Known areas still come back so the user is never stuck
    assert throttled["results"][0]["name"] == "Jayanagar"

    def upstream_429(url, params):
        raise geo.UpstreamThrottled()
    monkeypatch.setattr(geo, "http_get_json", upstream_429)
    monkeypatch.setattr(geo.PHOTON_QUEUE, "max_wait", 5.0)
    geo.PHOTON_QUEUE.reset()
    assert c.get("/geo/search", params={"q": "something else"}).json()["throttled"] is True


def test_reverse_geocode_is_cached_by_rounded_coordinates(monkeypatch):
    calls = []
    monkeypatch.setattr(geo, "http_get_json", fake_photon(calls))
    c = TestClient(app)
    a = c.get("/geo/reverse", params={"lat": 12.927912, "lng": 77.582611}).json()
    b = c.get("/geo/reverse", params={"lat": 12.927914, "lng": 77.582613}).json()
    assert len(calls) == 1 and b["cached"] is True
    assert a["area"] == "Jayanagar" and a["accuracy"] == "pin"
    far = c.get("/geo/reverse", params={"lat": 12.3052, "lng": 76.6552}).json()
    assert far["in_range"] is False


# -----------------------------------------------------------------------------
# Google Maps links
# -----------------------------------------------------------------------------
@pytest.mark.parametrize("url,expected", [
    ("https://www.google.com/maps/place/Lalbagh/@12.9507,77.5848,17z", (12.9507, 77.5848)),
    ("https://www.google.com/maps/place/X/@12.95,77.58,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d12.9279!4d77.5826", (12.9279, 77.5826)),
    ("https://maps.google.com/?q=12.9352,77.6245", (12.9352, 77.6245)),
    ("https://maps.google.com/maps?ll=12.9784,77.6408&z=16", (12.9784, 77.6408)),
    ("https://www.google.com/maps/search/?api=1&query=12.9121%2C77.6446", (12.9121, 77.6446)),
])
def test_maps_link_coordinates_are_parsed(url, expected):
    assert geo.resolve_maps_link(url, fetch=lambda *_: pytest.fail("no network needed")) == expected


def test_short_link_follows_only_allowlisted_redirects():
    hops = []

    def fetch(url, timeout):
        hops.append(url)
        assert timeout <= 3.0
        if url == "https://maps.app.goo.gl/abc123":
            return 302, "https://www.google.com/maps/place/Spot/data=!4m2!3m1!1s0x0"
        return 302, "https://www.google.com/maps/place/Spot/@12.9166,77.6101,17z"

    assert geo.resolve_maps_link("https://maps.app.goo.gl/abc123", fetch=fetch) == (12.9166, 77.6101)
    assert len(hops) == 2

    # A redirect to anywhere outside the allowlist is never followed
    evil_hops = []

    def evil(url, timeout):
        evil_hops.append(url)
        return 302, "http://169.254.169.254/latest/meta-data"
    with pytest.raises(geo.MapsLinkError):
        geo.resolve_maps_link("https://maps.app.goo.gl/evil", fetch=evil)
    assert evil_hops == ["https://maps.app.goo.gl/evil"]

    # Never more than 3 redirects
    loop_hops = []

    def loop(url, timeout):
        loop_hops.append(url)
        return 302, f"https://maps.app.goo.gl/next{len(loop_hops)}"
    with pytest.raises(geo.MapsLinkError):
        geo.resolve_maps_link("https://maps.app.goo.gl/loop", fetch=loop)
    assert len(loop_hops) == 3

    # Other hosts, plain http, and ports are refused without any request
    for bad in ("https://evil.example/maps", "http://maps.app.goo.gl/x", "https://maps.app.goo.gl:8443/x",
                "https://user@maps.app.goo.gl/x", "https://goo.gl/notmaps"):
        with pytest.raises(geo.MapsLinkError):
            geo.resolve_maps_link(bad, fetch=lambda *_: pytest.fail(f"fetched {bad}"))


# -----------------------------------------------------------------------------
# Join links and demo reset
# -----------------------------------------------------------------------------
def test_join_link_prefills_airport_and_landing_time():
    c = client_for("sess_joiner_01")
    new_request(c, area="Jayanagar", flight_no="6E 2134")
    link = c.post("/join-links").json()
    assert link["path"].startswith("/j/")
    data = TestClient(app).get(f"/join/{link['token']}").json()
    assert data["airport"] == "BLR" and data["flight_no"] == "6E2134"
    assert data["scheduled_arrival"]
    assert "dest" not in json.dumps(data) and "Jayanagar" not in json.dumps(data)
    assert TestClient(app).get("/join/nope").status_code == 404


def test_reset_restores_the_seed():
    db = SessionLocal()
    seed_count = db.query(PassengerRequest).count()
    db.close()
    c = client_for("sess_messy_01")
    new_request(c, area="Jayanagar")
    best_id = c.get("/trip").json()["options"]["best_id"]
    groups = c.get("/trip").json()["options"]["groups"]
    best = next(g for g in groups if g["id"] == best_id)
    c.post("/proposals", json={"member_request_ids": [m["request_id"] for m in best["members"] if not m["is_you"]]})
    c.post("/demo/respond")
    c.post("/demo/advance?minutes=45")

    r = TestClient(app).post("/demo/reset")
    assert r.status_code == 200
    db = SessionLocal()
    assert db.query(PassengerRequest).count() == seed_count
    assert db.query(Group).count() == 0
    assert db.query(Proposal).count() == 0
    db.close()
    assert abs(CLOCK.get_offset_minutes()) < 0.01
    assert c.get("/trip").json()["state"] == "start"


def test_purge_deletes_real_trips_after_24_hours():
    from backend.main import purge_expired
    c = client_for("sess_old_trip_01")
    new_request(c, area="Jayanagar", exact_address=SECRET_A)
    CLOCK.advance_minutes(24 * 60 + 5)
    db = SessionLocal()
    assert purge_expired(db) == 1
    assert db.query(PassengerRequest).filter(PassengerRequest.is_demo == False).count() == 0  # noqa: E712
    db.close()


def test_outbound_geocoder_urls_are_not_logged():
    import logging
    import backend.main  # noqa: F401  (configures logging)
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING
    assert logging.getLogger("httpcore").getEffectiveLevel() >= logging.WARNING


def test_co_passenger_messaging_in_group():
    c = client_for("sess_msg_user_01")
    new_request(c, area="Indiranagar")
    opts = c.get("/trip").json()["options"]["groups"][0]
    members = [m["request_id"] for m in opts["members"] if not m.get("is_you")]
    c.post("/proposals", json={"member_request_ids": members, "first_name": "Rohan"})
    c.post("/demo/respond")
    trip = c.get("/trip").json()
    assert trip["state"] == "confirmed"
    group_id = trip["group"]["id"]

    res = c.post(f"/groups/{group_id}/messages", json={"text": "At baggage belt 4 now"}).json()
    assert res["state"] == "confirmed"
    msgs = res["group"]["messages"]
    assert len(msgs) >= 1
    assert any(m["text"] == "At baggage belt 4 now" and m["is_you"] is True for m in msgs)

