"""
backend/matching.py — Pure matching algorithm for EcoRide Share.
Contains the candidate filtering, subset enumeration, early pruning,
OSRM/Haversine distance matrix evaluation, route permutation optimization,
capacity/detour/fare checks, tier assignment, and handoff link generation.
Unit testable with zero I/O except the distance cache.
"""
import itertools
from urllib.parse import quote
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field

from backend.config import CONFIG
from backend.distance import haversine_distance_km, get_distance_matrix
from backend.clock import ensure_utc

class MatchMember(BaseModel):
    request_id: str
    first_name: str
    party_size: int
    checked_bags: int
    zone: str
    dest_label: str
    dest_lat: float
    dest_lng: float
    drop_index: int = 0
    solo_km: float = 0.0
    shared_km_to_drop: float = 0.0
    detour_ratio: float = 1.0
    extra_wait_min: int = 0
    solo_fare_est: float = 0.0
    fare_share_est: float = 0.0
    saving_inr: float = 0.0
    saving_pct: float = 0.0
    ready_time: datetime
    reliability_score: Optional[float] = None
    preferred_app: str = "any"
    is_demo: bool = False
    upi_id: Optional[str] = None

class MatchGroup(BaseModel):
    cab_type: str
    cab_name: str
    cab_multiplier: float
    depart_time: datetime
    shared_km: float
    solo_km_sum: float
    km_saved: float
    co2_saved_kg: float
    trees_equivalent: float
    fare_total_est: float
    drop_order: List[str]  # request IDs in drop sequence
    members: List[MatchMember]
    tier: str  # NOW | SOON | LATER
    viewer_extra_wait_min: int
    viewer_saving_inr: float
    viewer_saving_pct: float
    viewer_share_est: float
    viewer_solo_est: float
    avg_reliability: float = 1.0
    stops_summary: List[str] = Field(default_factory=list)

class SoloBaseline(BaseModel):
    solo_km: float
    solo_fare_est: float
    cab_type: str = "sedan"
    ready_time: datetime
    uber_link: str

class MatchingResult(BaseModel):
    viewer_request_id: str
    solo_baseline: SoloBaseline
    tiers: Dict[str, Optional[MatchGroup]]  # {"NOW": ..., "SOON": ..., "LATER": ...}
    all_valid_groups: List[MatchGroup]


def generate_uber_link(
    pickup_lat: float,
    pickup_lng: float,
    pickup_nickname: str,
    dropoff_lat: float,
    dropoff_lng: float,
    dropoff_nickname: str
) -> str:
    """Generates an Uber deep-link with URL-encoded coordinates and nicknames."""
    base = "https://m.uber.com/ul/?action=setPickup"
    p_lat = f"{pickup_lat:.6f}"
    p_lng = f"{pickup_lng:.6f}"
    d_lat = f"{dropoff_lat:.6f}"
    d_lng = f"{dropoff_lng:.6f}"
    p_nick = quote(pickup_nickname)
    d_nick = quote(dropoff_nickname)
    return f"{base}&pickup[latitude]={p_lat}&pickup[longitude]={p_lng}&pickup[nickname]={p_nick}&dropoff[latitude]={d_lat}&dropoff[longitude]={d_lng}&dropoff[nickname]={d_nick}"


def compute_solo_fare(solo_km: float) -> float:
    """Calculates solo fare estimate: BASE + PER_KM * km + ACCESS_FEE + TOLL."""
    fare = CONFIG.FARE_BASE + (CONFIG.FARE_PER_KM * solo_km) + CONFIG.AIRPORT_ACCESS_FEE + CONFIG.TOLL_FEE
    return round(fare, 2)


def fixed_fees() -> float:
    return CONFIG.FARE_BASE + CONFIG.AIRPORT_ACCESS_FEE + CONFIG.TOLL_FEE


def estimate_shared_total(shared_km: float, cab_multiplier: float = 1.0) -> float:
    return round(fixed_fees() + CONFIG.FARE_PER_KM * cab_multiplier * shared_km, 2)


def split_fare(total: float, members: List[Tuple[str, int, float]]) -> Dict[str, float]:
    """
    Splits a cab fare between members given as (request_id, seats, solo_km).
    Fixed fees (base + airport access + toll) split by seats; the rest is split
    in proportion to solo_km * seats. Used for the estimate and, unchanged, for the actual fare.
    """
    total_seats = sum(seats for _, seats, _ in members) or 1
    fixed_part = min(total, fixed_fees())
    dist_part = max(0.0, total - fixed_part)
    dist_weight = sum(km * seats for _, seats, km in members)
    shares: Dict[str, float] = {}
    for rid, seats, km in members:
        seat_share = fixed_part * (seats / float(total_seats))
        if dist_weight > 0.001:
            dist_share = dist_part * ((km * seats) / float(dist_weight))
        else:
            dist_share = dist_part * (seats / float(total_seats))
        shares[rid] = round(seat_share + dist_share, 2)
    return shares


def split_fare_whole_rupees(total: float, members: List[Tuple[str, int, float]]) -> Dict[str, int]:
    """split_fare rounded to whole rupees so the shares add up exactly to the rounded total."""
    exact = split_fare(total, members)
    target = int(round(total))
    floors = {rid: int(v) for rid, v in exact.items()}
    remainder = target - sum(floors.values())
    if remainder > 0:
        by_fraction = sorted(exact.keys(), key=lambda rid: exact[rid] - int(exact[rid]), reverse=True)
        for rid in by_fraction[:remainder]:
            floors[rid] += 1
    elif remainder < 0:
        by_fraction = sorted(exact.keys(), key=lambda rid: exact[rid] - int(exact[rid]))
        for rid in by_fraction[:abs(remainder)]:
            floors[rid] -= 1
    return floors


def select_cab_type(total_seats: int, total_bags: int) -> Optional[Tuple[str, float, str]]:
    """
    Selects smallest cab type that fits passengers and baggage.
    Returns (cab_type_key, multiplier, display_name) or None if no vehicle fits.
    """
    # Order of fleet from smallest to largest
    fleet_order = ["sedan", "suv", "tempo_traveller"]
    for key in fleet_order:
        cfg = CONFIG.CAB_TYPES[key]
        if total_seats <= cfg.seats and total_bags <= cfg.boot:
            return key, cfg.multiplier, cfg.name
    return None


def filter_candidate_pool(
    viewer_req: Any,
    all_requests: List[Any],
    current_time: datetime
) -> List[Any]:
    """
    Filters candidates for viewer R:
    - Same airport / operational day
    - Status in ('registered', 'landed', 'ready_at_pickup')
    - Not locked (lock_until is None or <= current_time)
    - Not viewer R
    - Within PREFILTER_RADIUS_KM of R's destination
    - Same women_only setting
    - |ready_i - ready_R| <= min(max_wait_i, max_wait_R) + 15
    - Capped at 12 nearest
    """
    viewer_ready = viewer_req.ready_time
    candidates = []

    for req in all_requests:
        if req.id == viewer_req.id:
            continue
        req_sess = getattr(req, "session_id", None)
        viewer_sess = getattr(viewer_req, "session_id", None)
        if req_sess and viewer_sess:
            if req_sess == viewer_sess:
                continue
            if req_sess.startswith("sess_demo_you") and viewer_sess.startswith("sess_demo_you"):
                continue
        if req.status not in ("registered", "landed", "ready_at_pickup"):
            continue
        if req.lock_until is not None and ensure_utc(req.lock_until) > ensure_utc(current_time):
            continue
        # Strict women_only segregation
        if req.women_only != viewer_req.women_only:
            continue

        # Terminal pickup alignment: both T1 and T2 passengers can match if airport is same,
        # but let's check destination proximity
        dist_dest = haversine_distance_km(
            viewer_req.dest_lat, viewer_req.dest_lng,
            req.dest_lat, req.dest_lng
        )
        if dist_dest > CONFIG.PREFILTER_RADIUS_KM:
            continue

        # Time difference check
        time_diff_min = abs((ensure_utc(req.ready_time) - ensure_utc(viewer_ready)).total_seconds()) / 60.0
        time_cap = min(viewer_req.max_wait_min, req.max_wait_min) + 15.0
        if time_diff_min > time_cap:
            continue

        candidates.append((dist_dest, req))

    # Sort by proximity to viewer destination and cap at 12 nearest
    candidates.sort(key=lambda x: x[0])
    return [c[1] for c in candidates[:12]]


def evaluate_group(
    viewer_req: Any,
    group_reqs: List[Any],
    db_session=None
) -> Optional[MatchGroup]:
    """
    Evaluates a candidate group (including viewer_req):
    1. Check departure time: depart(G) = max(ready_i).
    2. Check extra_wait_i = depart(G) - ready_i <= max_wait_i for all members.
    3. Check capacity: seats and boot baggage -> select smallest cab.
    4. Fetch distance matrix for {airport, drop_1, drop_2...}.
    5. Find shortest shared route permutation.
    6. Verify detour ratio and extra km cap for every member.
    7. Calculate shared total fare and split proportions.
    8. Verify each member saves >= MIN_SAVING_PCT (10%).
    9. Assign tier and return MatchGroup.
    """
    k = len(group_reqs)
    if k < 2 or k > 4:
        return None

    # 1. Departure time
    depart_time = max(ensure_utc(req.ready_time) for req in group_reqs)

    # 2. Extra wait check for all members
    member_wait_map = {}
    for req in group_reqs:
        extra_wait = int((ensure_utc(depart_time) - ensure_utc(req.ready_time)).total_seconds() / 60.0)
        if extra_wait > req.max_wait_min:
            return None
        member_wait_map[req.id] = extra_wait

    # 3. Capacity check
    total_seats = sum(req.party_size for req in group_reqs)
    total_bags = sum(req.checked_bags for req in group_reqs)
    cab_choice = select_cab_type(total_seats, total_bags)
    if cab_choice is None:
        return None
    cab_type, cab_multiplier, cab_name = cab_choice

    # 4. Airport coordinates: use viewer's terminal as base pickup point
    terminal_info = CONFIG.TERMINALS.get(viewer_req.terminal, list(CONFIG.TERMINALS.values())[0])
    airport_pt = (terminal_info.lat, terminal_info.lng)

    # Coordinates list: index 0 is airport, index 1..k are member destinations
    pts = [airport_pt] + [(req.dest_lat, req.dest_lng) for req in group_reqs]
    dist_matrix, _ = get_distance_matrix(pts, db_session)

    # Precompute solo distances from airport (index 0 to index i+1)
    solo_kms = {}
    for idx, req in enumerate(group_reqs):
        solo_kms[req.id] = dist_matrix[0][idx + 1]

    # 5. Permutation optimization for drop order (at most 4! = 24)
    # Permute the indices 1..k
    best_perm = None
    best_route_dist = float("inf")
    drop_indices = list(range(1, k + 1))

    for perm in itertools.permutations(drop_indices):
        route_dist = dist_matrix[0][perm[0]]
        for step in range(len(perm) - 1):
            route_dist += dist_matrix[perm[step]][perm[step + 1]]
        if route_dist < best_route_dist:
            best_route_dist = route_dist
            best_perm = perm

    if best_perm is None:
        return None

    shared_km = round(best_route_dist, 2)
    solo_km_sum = round(sum(solo_kms.values()), 2)
    km_saved = round(solo_km_sum - shared_km, 2)
    if km_saved <= 0:
        return None

    # Compute shared_km_to_drop for each member along optimal route
    cum_dist = 0.0
    cum_dist += dist_matrix[0][best_perm[0]]
    member_shared_km = {}
    drop_order_req_ids = []

    for step_idx, node_idx in enumerate(best_perm):
        if step_idx > 0:
            cum_dist += dist_matrix[best_perm[step_idx - 1]][node_idx]
        req = group_reqs[node_idx - 1]
        member_shared_km[req.id] = round(cum_dist, 2)
        drop_order_req_ids.append(req.id)

    # 6. Verify detour ratio and extra km per member
    detour_ratios = {}
    for req in group_reqs:
        s_km = solo_kms[req.id]
        sh_to_drop = member_shared_km[req.id]
        if s_km <= 0.05:
            ratio = 1.0
        else:
            ratio = round(sh_to_drop / s_km, 3)
        extra_km = round(sh_to_drop - s_km, 2)

        if ratio > CONFIG.MAX_DETOUR_RATIO:
            return None
        if extra_km > CONFIG.MAX_EXTRA_KM_PER_MEMBER:
            return None
        detour_ratios[req.id] = ratio

    # 7. Fare estimates & Split
    # solo_fare_i = BASE + PER_KM * solo_km_i + AIRPORT_ACCESS_FEE + TOLL
    solo_fares = {req.id: compute_solo_fare(solo_kms[req.id]) for req in group_reqs}
    shared_total_est = estimate_shared_total(shared_km, cab_multiplier)
    fare_shares = split_fare(
        shared_total_est,
        [(req.id, req.party_size, solo_kms[req.id]) for req in group_reqs],
    )

    savings_inr = {}
    savings_pct = {}
    for req in group_reqs:
        saving = round(solo_fares[req.id] - fare_shares[req.id], 2)
        pct = round((saving / solo_fares[req.id]) * 100.0, 1)

        # 8. Must save at least MIN_SAVING_PCT
        if pct < CONFIG.MIN_SAVING_PCT:
            return None

        savings_inr[req.id] = saving
        savings_pct[req.id] = pct

    # Environmental metrics
    co2_saved_kg = round(km_saved * CONFIG.CO2_KG_PER_KM, 2)
    trees_eq = round(co2_saved_kg / CONFIG.TREE_KG_PER_YEAR, 2)

    # Build MatchMember list
    match_members = []
    reliability_scores = []
    for req in group_reqs:
        drop_idx = drop_order_req_ids.index(req.id)
        # Check reliability
        rel = getattr(req.session, "reliability_score", None) if hasattr(req, "session") else None
        if rel is not None:
            reliability_scores.append(rel)

        match_members.append(MatchMember(
            request_id=req.id,
            first_name=req.first_name,
            party_size=req.party_size,
            checked_bags=req.checked_bags,
            zone=req.zone,
            dest_label=req.dest_label,
            dest_lat=req.dest_lat,
            dest_lng=req.dest_lng,
            drop_index=drop_idx,
            solo_km=solo_kms[req.id],
            shared_km_to_drop=member_shared_km[req.id],
            detour_ratio=detour_ratios[req.id],
            extra_wait_min=member_wait_map[req.id],
            solo_fare_est=solo_fares[req.id],
            fare_share_est=fare_shares[req.id],
            saving_inr=savings_inr[req.id],
            saving_pct=savings_pct[req.id],
            ready_time=req.ready_time,
            reliability_score=rel,
            preferred_app=req.preferred_app,
            is_demo=getattr(req, "is_demo", False),
            upi_id=getattr(req, "upi_id", None)
        ))

    # Sort match_members by drop order
    match_members.sort(key=lambda m: m.drop_index)

    # Viewer metrics
    viewer_wait = member_wait_map[viewer_req.id]
    viewer_saving = savings_inr[viewer_req.id]
    viewer_saving_pct_val = savings_pct[viewer_req.id]
    viewer_share = fare_shares[viewer_req.id]
    viewer_solo = solo_fares[viewer_req.id]

    # Assign Tier
    if viewer_wait <= CONFIG.TIER_NOW_MAX:
        tier = "NOW"
    elif viewer_wait <= CONFIG.TIER_SOON_MAX:
        tier = "SOON"
    else:
        tier = "LATER"

    avg_rel = round(sum(reliability_scores) / len(reliability_scores), 2) if reliability_scores else 1.0

    stops_summary = [f"Stop {i+1}: {m.zone} ({m.first_name})" for i, m in enumerate(match_members)]

    return MatchGroup(
        cab_type=cab_type,
        cab_name=cab_name,
        cab_multiplier=cab_multiplier,
        depart_time=depart_time,
        shared_km=shared_km,
        solo_km_sum=solo_km_sum,
        km_saved=km_saved,
        co2_saved_kg=co2_saved_kg,
        trees_equivalent=trees_eq,
        fare_total_est=shared_total_est,
        drop_order=drop_order_req_ids,
        members=match_members,
        tier=tier,
        viewer_extra_wait_min=viewer_wait,
        viewer_saving_inr=viewer_saving,
        viewer_saving_pct=viewer_saving_pct_val,
        viewer_share_est=viewer_share,
        viewer_solo_est=viewer_solo,
        avg_reliability=avg_rel,
        stops_summary=stops_summary
    )


def find_matching_options(
    viewer_req: Any,
    all_requests: List[Any],
    current_time: datetime,
    db_session=None
) -> MatchingResult:
    """
    Main matching entrypoint:
    1. Calculates SoloBaseline.
    2. Filters candidate pool (capped at 12).
    3. Enumerates all candidate subsets of size 1..3 from candidate pool.
    4. Evaluates each candidate group and prunes invalid ones.
    5. Selects the single best option for NOW, SOON, LATER.
    """
    terminal_info = CONFIG.TERMINALS.get(viewer_req.terminal, list(CONFIG.TERMINALS.values())[0])
    airport_pt = (terminal_info.lat, terminal_info.lng)
    pts = [airport_pt, (viewer_req.dest_lat, viewer_req.dest_lng)]
    dist_mat, _ = get_distance_matrix(pts, db_session)
    viewer_solo_km = dist_mat[0][1]
    viewer_solo_fare = compute_solo_fare(viewer_solo_km)

    uber_link = generate_uber_link(
        pickup_lat=terminal_info.lat,
        pickup_lng=terminal_info.lng,
        pickup_nickname=terminal_info.pickup_nickname,
        dropoff_lat=viewer_req.dest_lat,
        dropoff_lng=viewer_req.dest_lng,
        dropoff_nickname=viewer_req.dest_label or viewer_req.zone
    )

    solo_baseline = SoloBaseline(
        solo_km=viewer_solo_km,
        solo_fare_est=viewer_solo_fare,
        cab_type="sedan",
        ready_time=viewer_req.ready_time,
        uber_link=uber_link
    )

    # 2. Candidate pool
    pool = filter_candidate_pool(viewer_req, all_requests, current_time)

    # One table request covers every pair the subset search will need; evaluate_group then reads the cache.
    if pool:
        get_distance_matrix(
            [airport_pt, (viewer_req.dest_lat, viewer_req.dest_lng)] + [(r.dest_lat, r.dest_lng) for r in pool],
            db_session,
        )

    # 3. Enumerate all subsets of size 1 to 3 to add to viewer
    valid_groups = []
    for subset_size in (1, 2, 3):
        for subset in itertools.combinations(pool, subset_size):
            candidate_group = [viewer_req] + list(subset)
            mg = evaluate_group(viewer_req, candidate_group, db_session)
            if mg is not None:
                valid_groups.append(mg)

    # 4. Group by tier and pick the best in each tier
    # Sort criteria: viewer_saving descending, extra_wait ascending, group_size descending, reliability descending
    def group_sort_key(g: MatchGroup):
        return (
            -g.viewer_saving_inr,
            g.viewer_extra_wait_min,
            -len(g.members),
            -g.avg_reliability
        )

    tiers_dict: Dict[str, Optional[MatchGroup]] = {
        "NOW": None,
        "SOON": None,
        "LATER": None
    }

    tier_candidates: Dict[str, List[MatchGroup]] = {"NOW": [], "SOON": [], "LATER": []}
    for g in valid_groups:
        if g.tier in tier_candidates:
            tier_candidates[g.tier].append(g)

    for tier_name in ("NOW", "SOON", "LATER"):
        candidates = tier_candidates[tier_name]
        if candidates:
            candidates.sort(key=group_sort_key)
            tiers_dict[tier_name] = candidates[0]

    return MatchingResult(
        viewer_request_id=viewer_req.id,
        solo_baseline=solo_baseline,
        tiers=tiers_dict,
        all_valid_groups=valid_groups
    )


def approx_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance rounded to the nearest half kilometre, so it can't pinpoint anyone."""
    return max(0.5, round(haversine_distance_km(lat1, lng1, lat2, lng2) * 2) / 2)


def redact_group_for_viewer(group: Dict[str, Any], viewer: Any) -> Dict[str, Any]:
    """
    Other travellers only ever see an area name and an approximate distance.
    Labels, exact coordinates and payment handles of everyone except the viewer are removed;
    map points are rounded to 2 decimals (about 1 km).
    """
    out = dict(group)
    members = []
    for m in group.get("members", []):
        m = dict(m)
        if m.get("request_id") != viewer.id:
            m["approx_km_from_you"] = approx_km(viewer.dest_lat, viewer.dest_lng, m["dest_lat"], m["dest_lng"])
            m["dest_label"] = m.get("zone", "")
            m["dest_lat"] = round(m["dest_lat"], 2)
            m["dest_lng"] = round(m["dest_lng"], 2)
            m["upi_id"] = None
            m["is_you"] = False
        else:
            m["approx_km_from_you"] = 0.0
            m["is_you"] = True
        members.append(m)
    out["members"] = members
    return out
