"""
tests/test_matching.py — Comprehensive pytest suite for pure matching module,
fare split, capacity constraints, detour limits, tier assignment, Uber deep links,
and fallback logic.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from backend.config import CONFIG
from backend.distance import fallback_road_distance_km, haversine_distance_km
from backend.matching import (
    evaluate_group,
    find_matching_options,
    compute_solo_fare,
    generate_uber_link,
    select_cab_type,
    MatchMember
)

# Mock PassengerRequest object for testing
class DummyRequest:
    def __init__(
        self,
        req_id: str,
        first_name: str,
        dest_lat: float,
        dest_lng: float,
        zone: str = "Jayanagar",
        dest_label: str = "Jayanagar 4th Block",
        scheduled_arrival: datetime = None,
        delay_min: int = 0,
        flight_kind: str = "domestic",
        checked_bags: int = 0,
        party_size: int = 1,
        max_wait_min: int = 30,
        women_only: bool = False,
        terminal: str = "T1",
        preferred_app: str = "uber",
        status: str = "registered",
        lock_until: datetime = None
    ):
        self.id = req_id
        self.session_id = f"sess_{req_id}"
        self.first_name = first_name
        self.dest_lat = dest_lat
        self.dest_lng = dest_lng
        self.zone = zone
        self.dest_label = dest_label
        self.scheduled_arrival = scheduled_arrival or datetime(2026, 10, 21, 10, 0, tzinfo=timezone.utc)
        self.delay_min = delay_min
        self.flight_kind = flight_kind
        self.checked_bags = checked_bags
        self.party_size = party_size
        self.max_wait_min = max_wait_min
        self.women_only = women_only
        self.terminal = terminal
        self.preferred_app = preferred_app
        self.status = status
        self.lock_until = lock_until

    def exit_buffer_min(self) -> int:
        key = f"{self.flight_kind}_{'checked' if self.checked_bags > 0 else 'cabin'}"
        return CONFIG.EXIT_BUFFER_MIN.get(key, 25)

    @property
    def ready_time(self) -> datetime:
        return self.scheduled_arrival + timedelta(minutes=self.delay_min + self.exit_buffer_min())


@pytest.fixture
def base_time():
    return datetime(2026, 10, 21, 10, 0, tzinfo=timezone.utc)


def test_uber_link_encoding():
    link = generate_uber_link(
        pickup_lat=13.1989,
        pickup_lng=77.7068,
        pickup_nickname="BLR T1 Cab Pickup (Lane 2)",
        dropoff_lat=12.9308,
        dropoff_lng=77.5838,
        dropoff_nickname="Jayanagar 4th Block, Bengaluru"
    )
    assert "https://m.uber.com/ul/?action=setPickup" in link
    assert "pickup%5Blatitude%5D=13.198900" in link or "pickup[latitude]=13.198900" in link
    assert "BLR%20T1%20Cab%20Pickup%20%28Lane%202%29" in link
    assert "Jayanagar%204th%20Block%2C%20Bengaluru" in link


def test_select_cab_type():
    # 2 seats, 1 bag -> sedan
    cab = select_cab_type(2, 1)
    assert cab[0] == "sedan"
    assert cab[1] == 1.0

    # 4 seats, 4 bags -> exceeds sedan boot(3) -> suv
    cab = select_cab_type(4, 4)
    assert cab[0] == "suv"
    assert cab[1] == 1.25

    # 5 seats, 2 bags -> suv
    cab = select_cab_type(5, 2)
    assert cab[0] == "suv"

    # 7 seats -> tempo_traveller
    cab = select_cab_type(7, 3)
    assert cab[0] == "tempo_traveller"
    assert cab[1] == 1.6

    # 10 seats -> None (exceeds 9)
    cab = select_cab_type(10, 2)
    assert cab is None


def test_same_flight_group_accepted(base_time):
    # Two passengers from same flight landing at 10:00, heading to Jayanagar & JP Nagar
    r1 = DummyRequest("r1", "Asha", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time, max_wait_min=30)
    r2 = DummyRequest("r2", "Bikram", 12.9063, 77.5857, "JP Nagar", scheduled_arrival=base_time, max_wait_min=30)

    mg = evaluate_group(r1, [r1, r2])
    assert mg is not None
    assert len(mg.members) == 2
    assert mg.cab_type == "sedan"
    assert mg.km_saved > 0
    assert mg.viewer_saving_pct >= 10.0


def test_cross_flight_group_accepted(base_time):
    # Passenger 1 lands at 10:00 (ready at 10:15)
    r1 = DummyRequest("r1", "Asha", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time, max_wait_min=30)
    # Passenger 2 lands at 10:10 (ready at 10:25) -> 10 min difference, within max_wait_min 30
    r2 = DummyRequest("r2", "Chirag", 12.9166, 77.6101, "BTM", scheduled_arrival=base_time + timedelta(minutes=10), max_wait_min=30)

    mg = evaluate_group(r1, [r1, r2])
    assert mg is not None
    assert mg.viewer_extra_wait_min == 10
    assert mg.tier == "NOW"  # <= 15 min wait


def test_rejected_for_extra_wait_over_max_wait(base_time):
    # Passenger 1 max_wait is 15 min
    r1 = DummyRequest("r1", "Asha", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time, max_wait_min=15)
    # Passenger 2 arrives 30 mins later
    r2 = DummyRequest("r2", "Deepak", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time + timedelta(minutes=30), max_wait_min=30)

    # Depart time would be 10:45, causing r1 to wait 30 mins > r1.max_wait_min (15)
    mg = evaluate_group(r1, [r1, r2])
    assert mg is None


def test_fare_shares_sum_to_shared_total(base_time):
    # Group of 3 with different party sizes and bags
    r1 = DummyRequest("r1", "Asha", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time, party_size=1)
    r2 = DummyRequest("r2", "Bikram", 12.9063, 77.5857, "JP Nagar", scheduled_arrival=base_time, party_size=2)
    r3 = DummyRequest("r3", "Chirag", 12.9166, 77.6101, "BTM", scheduled_arrival=base_time, party_size=1)

    mg = evaluate_group(r1, [r1, r2, r3])
    assert mg is not None
    sum_shares = sum(m.fare_share_est for m in mg.members)
    # Due to float rounding of 2 decimals per share, difference should be within 0.05
    assert abs(sum_shares - mg.fare_total_est) < 0.10
    for m in mg.members:
        assert m.saving_pct >= 10.0


def test_detour_ratio_and_extra_km_cap(base_time):
    # Jayanagar (South) and Whitefield (East) are in completely opposite directions from BLR
    r1 = DummyRequest("r1", "Asha", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time)
    r_far = DummyRequest("r_far", "Far", 12.9698, 77.7499, "Whitefield", scheduled_arrival=base_time)

    # Combining Jayanagar and Whitefield in one cab should be rejected due to detour ratio or extra km
    mg = evaluate_group(r1, [r1, r_far])
    assert mg is None


def test_women_only_never_mixes(base_time):
    r_viewer = DummyRequest("r_viewer", "Priya", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time, women_only=True)
    r_general = DummyRequest("r_gen", "Rahul", 12.9308, 77.5838, "Jayanagar", scheduled_arrival=base_time, women_only=False)

    matching = find_matching_options(r_viewer, [r_viewer, r_general], base_time)
    # Should not match with r_general
    for tier in ("NOW", "SOON", "LATER"):
        if matching.tiers[tier] is not None:
            for m in matching.tiers[tier].members:
                assert m.request_id != "r_gen"


def test_book_solo_always_present(base_time):
    r_alone = DummyRequest("r_alone", "Sanjay", 12.8452, 77.6602, "Electronic City", scheduled_arrival=base_time)
    matching = find_matching_options(r_alone, [r_alone], base_time)
    assert matching.solo_baseline is not None
    assert matching.solo_baseline.solo_km > 0
    assert matching.solo_baseline.solo_fare_est > 1000
    assert "https://m.uber.com" in matching.solo_baseline.uber_link


def test_haversine_fallback():
    # BLR Airport (13.1986, 77.7066) to MG Road (12.9756, 77.6066)
    km = fallback_road_distance_km(13.1986, 77.7066, 12.9756, 77.6066)
    assert 30.0 < km < 50.0
