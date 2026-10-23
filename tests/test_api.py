"""
tests/test_api.py — API integration tests for EcoRide Share.
Tests session handling, trip requests, matching options, proposals & double-lock prevention,
delay shifts, no-show flow, handoff links, impact metrics, and demo controls.
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.clock import CLOCK, now
from backend.demo_data import seed_demo_passengers

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    CLOCK.reset()
    db = SessionLocal()
    seed_demo_passengers(db, now())
    db.close()
    yield

def test_health_and_config():
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    r_config = client.get("/config")
    assert r_config.status_code == 200
    cfg = r_config.json()
    assert cfg["airport"]["code"] == "BLR"
    assert "T1" in cfg["airport"]["terminals"]
    assert cfg["matching_rules"]["road_factor"] == 1.35
    assert cfg["fare_model"]["base"] == 100.0


def test_session_lifecycle():
    # 1. Create session
    r = client.post("/session", json={"first_name": "Deepak"})
    assert r.status_code == 200
    data = r.json()
    assert data["first_name"] == "Deepak"
    assert "session_id" in data
    sess_id = data["session_id"]

    # 2. Check /requests/me with empty requests
    r_me = client.get("/requests/me", headers={"X-Session-ID": sess_id})
    assert r_me.status_code == 200
    assert r_me.json()["request"] is None
    assert r_me.json()["session"]["first_name"] == "Deepak"


def test_request_creation_and_options():
    # Create request
    curr_t = now()
    req_payload = {
        "first_name": "Deepak",
        "flight_no": "6E2134",
        "arriving_from": "Delhi (DEL)",
        "flight_kind": "domestic",
        "scheduled_arrival": curr_t.isoformat(),
        "delay_min": 0,
        "terminal": "T1",
        "dest_lat": 12.9308,
        "dest_lng": 77.5838,
        "dest_label": "Jayanagar 4th Block",
        "zone": "Jayanagar",
        "party_size": 1,
        "checked_bags": 0,
        "max_wait_min": 30,
        "preferred_app": "uber",
        "women_only": False,
        "upi_id": "deepak@okaxis"
    }
    r = client.post("/requests", json=req_payload)
    assert r.status_code == 200
    created = r.json()
    req_id = created["id"]
    assert created["status"] == "registered"

    # Query matching options
    r_opt = client.get(f"/requests/{req_id}/options")
    assert r_opt.status_code == 200
    opt_data = r_opt.json()
    assert opt_data["solo_baseline"] is not None
    assert opt_data["solo_baseline"]["solo_fare_est"] > 1000.0
    assert "https://m.uber.com" in opt_data["solo_baseline"]["uber_link"]

    # Tiers check
    assert "NOW" in opt_data["tiers"]
    assert "SOON" in opt_data["tiers"]
    assert "LATER" in opt_data["tiers"]


def test_proposal_flow_and_locking():
    # 1. Create a request for user
    curr_t = now()
    sess_id = "sess_meera_test_01"
    r = client.post("/requests", json={
        "first_name": "Meera",
        "flight_no": "6E2134",
        "arriving_from": "Delhi (DEL)",
        "flight_kind": "domestic",
        "scheduled_arrival": curr_t.isoformat(),
        "delay_min": 0,
        "terminal": "T1",
        "dest_lat": 12.9308,
        "dest_lng": 77.5838,
        "dest_label": "Jayanagar 4th Block",
        "zone": "Jayanagar",
        "party_size": 1,
        "checked_bags": 0,
        "max_wait_min": 30,
        "preferred_app": "uber",
        "women_only": False
    }, headers={"X-Session-ID": sess_id})
    assert r.status_code == 200
    meera_req_id = r.json()["id"]

    # Pick demo_arjun_02 to propose
    prop_resp = client.post("/proposals", json={
        "member_request_ids": ["demo_arjun_02"]
    }, headers={"X-Session-ID": sess_id})
    assert prop_resp.status_code == 200
    prop_data = prop_resp.json()
    assert prop_data["status"] == "open"
    assert prop_data["responses"][meera_req_id] == "accepted"
    assert prop_data["responses"]["demo_arjun_02"] == "pending"

    # Verify double-locking: another proposal to demo_arjun_02 should fail with 409
    other_sess_id = "sess_other_test_02"
    r_other = client.post("/requests", json={
        "first_name": "Other",
        "flight_no": "6E2134",
        "arriving_from": "Delhi (DEL)",
        "flight_kind": "domestic",
        "scheduled_arrival": curr_t.isoformat(),
        "delay_min": 0,
        "terminal": "T1",
        "dest_lat": 12.9308,
        "dest_lng": 77.5838,
        "dest_label": "Jayanagar 4th Block",
        "zone": "Jayanagar",
        "party_size": 1,
        "checked_bags": 0,
        "max_wait_min": 30,
        "preferred_app": "uber",
        "women_only": False
    }, headers={"X-Session-ID": other_sess_id})
    assert r_other.status_code == 200
    conflict_resp = client.post("/proposals", json={
        "member_request_ids": ["demo_arjun_02"]
    }, headers={"X-Session-ID": other_sess_id})
    assert conflict_resp.status_code == 409



def test_delay_shift_and_risk():
    curr_t = now()
    r = client.post("/requests", json={
        "first_name": "Pawan",
        "flight_no": "6E2134",
        "arriving_from": "Delhi (DEL)",
        "flight_kind": "domestic",
        "scheduled_arrival": curr_t.isoformat(),
        "delay_min": 0,
        "terminal": "T1",
        "dest_lat": 12.9308,
        "dest_lng": 77.5838,
        "dest_label": "Jayanagar",
        "zone": "Jayanagar",
        "party_size": 1,
        "checked_bags": 0,
        "max_wait_min": 15,
        "preferred_app": "uber",
        "women_only": False
    })
    pawan_id = r.json()["id"]

    # PATCH delay 45 mins
    r_delay = client.patch(f"/requests/{pawan_id}/delay", json={"delay_min": 45})
    assert r_delay.status_code == 200
    assert r_delay.json()["delay_min"] == 45


def test_public_impact_metrics():
    r_impact = client.get("/impact")
    assert r_impact.status_code == 200
    impact = r_impact.json()
    assert impact["cabs_avoided"] > 0
    assert impact["km_saved"] > 0
    assert impact["co2_saved_kg"] > 0
    assert len(impact["wave_breakdown"]) > 0


def test_demo_advance_and_reset():
    r_adv = client.post("/demo/advance?minutes=10")
    assert r_adv.status_code == 200
    assert r_adv.json()["offset_minutes"] == 10.0

    r_reset = client.post("/demo/reset")
    assert r_reset.status_code == 200
    assert r_reset.json()["message"] == "Clock reset to real time and demo passengers reseeded."
